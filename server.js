require("dotenv").config();

const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const axios = require("axios");
const cheerio = require("cheerio");
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(__dirname));

const db = new sqlite3.Database("./sites.db");

/* -----------------------------
UTILITY FUNCTIONS
------------------------------*/

function countMatches(arr){
  const counts = {};
  arr.forEach(item => {
    if(!item) return;
    counts[item] = (counts[item] || 0) + 1;
  });
  return counts;
}

function getTopEntries(counts, limit = 5){
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(entry => entry[0]);
}

function extractHexColors(text){
  if(!text) return [];
  const matches = text.match(/#[0-9a-fA-F]{3,6}\b/g);
  return matches || [];
}

function cleanFontValue(fontValue){
  return fontValue
    .replace(/font-family\s*:/i, "")
    .replace(/;/g, "")
    .split(",")[0]
    .replace(/["']/g, "")
    .trim();
}

// --- ADDED ---
// Detect rough layout patterns from a page
function detectLayoutPatterns($){

  const layout = []

  $("header, nav, section, div, footer").each((i,el)=>{

    const element = $(el)
    const tag = el.tagName?.toLowerCase() || ""

    const text = element.text().toLowerCase()
    const headings = element.find("h1,h2,h3")
    const images = element.find("img")

    const children = element.children("div")

    // --- HEADER / NAVBAR ---
    if(tag === "header" || tag === "nav"){
      layout.push("header")
      return
    }

    // --- FOOTER ---
    if(tag === "footer"){
      layout.push("footer")
      return
    }

    // --- HERO SECTION ---
    if(
      element.find("h1").length > 0 && images.length > 0
    ){
      layout.push("hero")
      return
    }

    // --- CARD GRID ---
    if(children.length >= 3){

      const similarChildren = children.filter((i,child)=>{
        return $(child).find("img,h3,h4").length > 0
      })

      if(similarChildren.length >= 3){
        layout.push("cards")
        return
      }
    }

    // --- STATS BLOCK ---
    const numbers = text.match(/\b\d{2,}\b/g)
    if(numbers && numbers.length >= 3){
      layout.push("stats")
      return
    }

    // --- TIMELINE / HISTORY ---
    if(
      text.includes("timeline") ||
      text.includes("milestone") ||
      text.includes("history")
    ){
      layout.push("timeline")
      return
    }

  })

  return layout
}




function sanitizeLayout(layout){
  const allowedTypes = new Set([
    "header",
    "hero",
    "banner",
    "cards",
    "text",
    "stats",
    "timeline",
    "footer"
  ]);

  if(!Array.isArray(layout)) return [];

  const cleaned = layout
    .filter(section => section && allowedTypes.has(section.type))
    .map(section => {
      if(section.type === "cards"){
        return {
          type: "cards",
          columns:
            typeof section.columns === "number" &&
            section.columns >= 1 &&
            section.columns <= 4
              ? section.columns
              : 3
        };
      }

      if(section.type === "text"){
        return {
          type:"text",
          rows: typeof section.rows === "number" ? section.rows : undefined,
          columns: typeof section.columns === "number" ? section.columns : undefined
        }
      }


return { type: section.type };

    });

  return cleaned;
}

/* -----------------------------
PROMPT STRUCTURE ENFORCER
------------------------------*/

function enforcePromptLayout(goal, layout){

  if(!Array.isArray(layout) || layout.length === 0){
    return layout
  }

  const text = (goal || "").toLowerCase()

  const match = text.match(/(\d+)\s*(text|textbox|text box|box|boxes|section|sections)/)
  if(!match) return layout

  const count = parseInt(match[1])

  const strictOnly = text.includes("only")
  const mustHave =
    text.includes("must have") ||
    text.includes("should have") ||
    text.includes("needs") ||
    text.includes("require")

  const noHeader = text.includes("no header")
  const noFooter = text.includes("no footer")
  const noCards = text.includes("no cards")
  const noHero = text.includes("no hero")
  const noBanner = text.includes("no banner")


  const wantsSquare =
    text.includes("square") ||
    text.includes("grid") ||
    text.includes("2x2")

  const forced = []

  if(!noHeader){
    forced.push({ type:"header" })
  }

  if(wantsSquare && count === 4){
    forced.push({ type:"text", rows:2, columns:2 })
  }else{
    for(let i=0;i<count;i++){
      forced.push({ type:"text" })
    }
  }

  if(!noFooter){
    forced.push({ type:"footer" })
  }

  // STRICT MODE
  if(strictOnly){
    return forced
  }

  // MERGE MODE
  const merged = [...layout]

  // remove header if forbidden
  if(noHeader){
    const headerIndex = merged.findIndex(s => s.type === "header")
    if(headerIndex !== -1){
      merged.splice(headerIndex,1)
}

  }

  // remove footer if forbidden
  if(noFooter){
    for(let i=merged.length-1;i>=0;i--){
      if(merged[i].type === "footer"){
        merged.splice(i,1)
      }
    }
  }
  
  // remove forbidden sections
for(let i = merged.length - 1; i >= 0; i--){
  const type = merged[i].type

  if(noCards && type === "cards") merged.splice(i,1)
  if(noHero && type === "hero") merged.splice(i,1)
  if(noBanner && type === "banner") merged.splice(i,1)
}

  // ensure header exists if allowed
  if(!noHeader && !merged.some(s => s.type === "header")){
    merged.unshift({ type:"header" })
  }

  // count existing text boxes correctly
  const existingText = merged
    .filter(s => s.type === "text")
    .reduce((total, s)=>{
      if(s.rows && s.columns){
        return total + (s.rows * s.columns)
      }
      return total + 1
    },0)

  if(existingText < count){

    if(wantsSquare && count === 4){
      merged.push({ type:"text", rows:2, columns:2 })
    }else{
      for(let i=0;i<count-existingText;i++){
        merged.push({ type:"text" })
      }
    }

  }

  return merged
}




/* -----------------------------
BluePrint PAGE ANALYSIS
------------------------------*/

async function analyzeSinglePage(url){
  try{
    const response = await axios.get(url, {
      timeout: 10000,
      headers: { "User-Agent": "Mozilla/5.0 BluePrintPlannerPrototype" },
      validateStatus: () => true
    });

    if(response.status === 404){
      return { url, error: true, colors: [], fonts: [] };
    }

    const html = response.data;

    if(
      typeof html !== "string" ||
      html.toLowerCase().includes("page not found") ||
      html.toLowerCase().includes("can't find the page")
    ){
      return { url, error: true, colors: [], fonts: [] };
    }

    const $ = cheerio.load(html);

    // --- ACCESSIBILITY CHECK: missing alt text on images ---
    const images = $("img");
    const missingAltText = images.filter((i, img) => {
      const alt = $(img).attr("alt");
      return !alt || alt.trim() === "";
    }).length;

    // --- ADDED ---
    const layoutPatterns = detectLayoutPatterns($);


    const styleText = $("style")
      .map((i, el) => $(el).html())
      .get()
      .join("\n");

    const inlineStyleText = $("[style]")
      .map((i, el) => $(el).attr("style"))
      .get()
      .join("\n");

    const combinedStyleText = `${styleText}\n${inlineStyleText}`;

    const colors = extractHexColors(combinedStyleText);

    const fontMatches = combinedStyleText.match(/font-family\s*:[^;]+;/gi) || [];
    const fonts = fontMatches.map(cleanFontValue);

    
    return { 
      url, 
      colors, 
      fonts, 
      layout: layoutPatterns,
      missingAltText 
    };
  }catch(error){
    return { url, error: true, colors: [], fonts: [], layout: [], missingAltText: 0 };
  }
}

/* -----------------------------
STYLE SUMMARY
------------------------------*/

function buildStyleSummary(results){
  const successful = results.filter(r => !r.error);

  const allColors = successful.flatMap(r => r.colors);
  const allFonts = successful.flatMap(r => r.fonts);
  // --- ADDED ---
  const allLayouts = successful.flatMap(r => r.layout || []);

  const totalMissingAlt = successful.reduce((sum, r) => sum + (r.missingAltText || 0), 0);

  const colorCounts = countMatches(allColors);
  const fontCounts = countMatches(allFonts);
  // --- ADDED ---
  const layoutCounts = countMatches(allLayouts);


  const topColors = getTopEntries(colorCounts, 5);
  const topFonts = getTopEntries(fontCounts, 3);
  // --- ADDED ---
  const topLayouts = getTopEntries(layoutCounts, 4);


  return {
    scannedPages: results.length,
    validPages: successful.length,
    colors: topColors,
    fonts: topFonts,
    layoutPatterns: topLayouts,
    missingAltText: totalMissingAlt,
    generalStyle: topLayouts.map(section => {

      if(section === "header")
        return "Top navigation header with corporate branding"

      if(section === "hero")
        return "Large hero banner sections with prominent headings"

      if(section === "cards")
        return "Grid-based card layouts used for content sections"

      if(section === "stats")
        return "Statistics or metric sections highlighting achievements"

      if(section === "timeline")
        return "Timeline or milestone sections describing company history"

      if(section === "footer")
        return "Structured footer containing navigation and corporate links"

      return `Common layout section: ${section}`

    })

  };
}

/* -----------------------------
API: BluePrint STYLE ANALYSIS
------------------------------*/

app.get("/api/blueprint-style", async (req, res) => {
  db.all("SELECT url FROM sites", async (err, rows) => {
    if(err){
      return res.status(500).json({ error: "Database read failed" });
    }

    const urls = rows.map(r => r.url);

    console.log("Scanning BluePrint pages:", urls.length);

    const results = await Promise.all(
      urls.map(url => analyzeSinglePage(url))
    );

    const summary = buildStyleSummary(results);

    res.json({ summary });
  });
});

/* -----------------------------
AI TASK + LAYOUT GENERATION
------------------------------*/

app.post("/api/generateTasks", async (req, res) => {
  const { goal, roles, days, style, currentSite } = req.body;

  let missingAltText = 0;
  let hasH1 = false;

  if(currentSite && currentSite.trim().length > 0){
    const $ = cheerio.load(currentSite);

    missingAltText = $("img").filter((i, img)=>{
      const alt = $(img).attr("alt");
      return !alt || alt.trim() === "";
    }).length;

    hasH1 = $("h1").length > 0;
  }


  const people = Array.isArray(roles) ? roles.length : 0;
  const totalTasks = people * days;

  const labeledRoles = (roles || []).map((r, i) => `Person ${i + 1} – ${r}`);

  try{
    const prompt = `
You are planning a webpage and development workflow for a team building a website.

PAGE GOAL
${goal}

BluePrint DESIGN STYLE (detected from real BluePrint pages)
Colours: ${(style?.colors || []).join(", ")}
Fonts: ${(style?.fonts || []).join(", ")}

Common layout patterns across BluePrint pages:
${(style?.layoutPatterns || []).join(", ")}

TEAM MEMBERS
${labeledRoles.join(", ")}

ACCESSIBILITY NOTES
Images missing alt text: ${missingAltText}
Page contains main H1 heading: ${hasH1 ? "Yes" : "No"}

If accessibility issues are deteced (such as missing alt text), include them in the review notes.

If images are missing alt text, include tasks suggesting how to fix them.

CURRENT WEBSITE HTML (may be incomplete)
${currentSite && currentSite.trim().length > 0 ? currentSite : "No current website provided"}

You must produce TWO things:

-----------------------------------
1. WEBSITE REVIEW
-----------------------------------

If HTML code was provided, review ONLY that code.

Identify:
• what sections already exist
• what is missing
• what could be improved

Give 3–5 short bullet points.

If no HTML was provided return:
["No current website provided yet. Start by building the main structure."]

-----------------------------------
2. PAGE LAYOUT
-----------------------------------

Create a wireframe layout using these section types ONLY:

header
hero
banner
cards
text
stats
timeline
footer

Rules:

• The user's request may contain STRICT structural requirements.
• If the user specifies a number of sections or boxes, you MUST match that number.
• If the user says "only", you must return ONLY those sections.
• If the user says "exactly", you must match the number of requested boxes but other sections may still exist.
• If the user says "no footer" or "no header", do not include them.
• If the user describes a grid (for example "4 boxes in a square"), you may use:
  { "type":"text", "rows":2, "columns":2 }

• Otherwise design a layout consistent with modern blueprint-style corporate websites.

Cards may include:
"columns": 1–4

Layout must always be ordered from top to bottom.

Example:

[
 {"type":"header"},
 {"type":"hero"},
 {"type":"cards","columns":3},
 {"type":"footer"}
]

-------------------

Return ONLY JSON:

{
 "review":[
   "Short bullet point"
 ],
 "layout":[
   {"type":"header"},
   {"type":"hero"},
   {"type":"cards","columns":3},
   {"type":"footer"}
 ]
}
`;


    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Return JSON only." },
        { role: "user", content: prompt }
      ],
      temperature: 0.4
    });

    let text = completion.choices[0].message.content || "";
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    let parsed;

    try{
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if(jsonMatch){
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found");
      }
    }catch(e){
      console.log("AI response parse error:", text);
      parsed = { review: [], layout: [], tasks: [] };
    }


    if(!Array.isArray(parsed.review)){
      parsed.review = ["AI review unavailable."];
    }

    parsed.layout = sanitizeLayout(parsed.layout);
    parsed.layout = enforcePromptLayout(goal, parsed.layout);


// -----------------------------
// SECOND AI CALL: GENERATE TASKS
// -----------------------------

const taskPrompt = `

You are generating highly specific development tasks for building a webpage.

PAGE GOAL
${goal}

FINAL PAGE LAYOUT (THIS IS THE EXACT STRUCTURE OF THE PAGE)
${JSON.stringify(parsed.layout, null, 2)}

CRITICAL RULE:
Tasks MUST ONLY reference sections that exist in the FINAL PAGE LAYOUT.

If a section type is not present in the layout, you MUST NOT generate tasks for it.

For example:
• If there is no header in the layout → do NOT create header tasks.
• If there are 4 text boxes → create tasks related to those 4 text boxes.
• If there are cards → create tasks for cards.

Tasks must correspond directly to the sections listed in FINAL PAGE LAYOUT.

BluePrint DESIGN STYLE
Colours: ${(style?.colors || []).join(", ")}
Fonts: ${(style?.fonts || []).join(", ")}

TEAM MEMBERS
${labeledRoles.join(", ")}

There are ${days} project days and ${people} team members.

This means you must generate EXACTLY ${totalTasks} tasks.

CRITICAL RULES:

• Each team member must have a task every day.
• Tasks must directly build the webpage described by the FINAL PAGE LAYOUT.
• Tasks must reference the layout sections explicitly (header, hero, cards, text grid, etc).
• Tasks must describe specific UI or implementation work.
• Each task must match and be relevant to the team member's role.
• Each task must leave room for human touch (only suggest, don't explicity force a single colour).
• Every element / type of element needs to be discussed in at least one task somewhere, as the layout should be able to replicated just by following the steps.

Each task should include (if relevant to role):

• concrete layout decisions (grid structure, spacing, alignment)
• specific UI elements being built (buttons, cards, headings, etc)
• typography suggestions using the detected fonts
• colour suggestions using the detected BluePrint palette

When suggesting colours, provide **2–3 possible options** from the palette.

Example:
Recommended colours: (#010144, #0055ff, #f5f5f9)

Mention details such as:
• padding or spacing suggestions
• grid structure (for example 2x2 grid)
• responsive behaviour for smaller screens
• hover or interaction states where relevant

Avoid vague tasks such as:
- "conduct research"
- "create personas"
- "review the design"

All tasks must describe **actual work that builds the page UI or content**.

Example good tasks:

• Create a 2x2 CSS Grid layout for the milestone text boxes. Use equal column widths and a gap of approximately 24–32px between boxes.

• Style each milestone card with a light background (#ffffff or #f5f5f9) and subtle shadow. Use padding around 20–24px and rounded corners.

• Design a primary call-to-action button encouraging users to explore BluePrint innovations. Recommended colours: (#010144, #0055ff). Use white text and slight border radius.

• Apply typography styles using ${style?.fonts?.[0] || "Noto Sans"} for headings and body text.

Return JSON only:

{
 "tasks":[
   {"person":"Person 1 – UI Designer","day":1,"task":"..."}
 ]
}
`;


const taskCompletion = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    { role: "system", content: "Return JSON only." },
    { role: "user", content: taskPrompt }
  ],
  temperature: 0.4
});

let taskText = taskCompletion.choices[0].message.content || "";
taskText = taskText.replace(/```json/g, "").replace(/```/g, "").trim();

let taskParsed;

try{
  taskParsed = JSON.parse(taskText);
}catch{
  taskParsed = { tasks: [] };
}

parsed.tasks = taskParsed.tasks || [];



    if(parsed.layout.length === 0){
      parsed.layout = [
        { type: "header" },
        { type: "hero" },
        { type: "cards", columns: 3 },
        { type: "footer" }
      ];
    }



    res.json(parsed);
  }catch(err){
    console.error(err);

    const fallbackTasks = [];

    for(let i = 0; i < totalTasks; i++){
      fallbackTasks.push({
        person: labeledRoles[i % labeledRoles.length],
        day: Math.floor(i / labeledRoles.length) + 1,
        task: "Create or refine a webpage section including layout, visuals, and supporting content."
      });
    }

    res.json({
      review: ["AI review unavailable due to generation error."],
      layout: enforcePromptLayout(goal, [
        { type: "text" },
        { type: "text" },
        { type: "text" },
        { type: "text" }
      ]),
      tasks: fallbackTasks
    });
  }
});


/* -----------------------------
START SERVER
------------------------------*/

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});