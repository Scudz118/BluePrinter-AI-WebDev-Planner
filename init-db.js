const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./sites.db");

db.serialize(() => {
  db.run(`DROP TABLE IF EXISTS sites`);

  db.run(`
    CREATE TABLE sites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL
    )
  `);

  const stmt = db.prepare(`INSERT INTO sites (url) VALUES (?)`);

  const urls = [
  "https://www.pfizer.com",
  "https://www.pfizer.com/about",
  "https://www.pfizer.com/news",
  "https://www.pfizer.com/science",
  "https://www.pfizer.com/products",
  "https://www.pfizer.com/purpose",
  "https://www.pfizer.com/people",
  "https://www.pfizer.com/responsibility",
  "https://www.pfizer.com/partners",
  "https://www.pfizer.com/contact",

  "https://www.pfizer.com/about/history",
  "https://www.pfizer.com/about/leadership",
  "https://www.pfizer.com/about/structure",
  "https://www.pfizer.com/about/innovation",
  "https://www.pfizer.com/about/values",

  "https://www.pfizer.com/science/research-development",
  "https://www.pfizer.com/science/clinical-trials",
  "https://www.pfizer.com/science/pipeline",
  "https://www.pfizer.com/science/areas-of-focus",
  "https://www.pfizer.com/science/technology",

  "https://www.pfizer.com/products/product-list",
  "https://www.pfizer.com/products/vaccines",
  "https://www.pfizer.com/products/oncology",
  "https://www.pfizer.com/products/cardiology",
  "https://www.pfizer.com/products/inflammation",

  "https://www.pfizer.com/news/press-releases",
  "https://www.pfizer.com/news/media-resources",
  "https://www.pfizer.com/news/announcements",
  "https://www.pfizer.com/news/feature-stories",
  "https://www.pfizer.com/news/podcast",

  "https://www.pfizer.com/purpose/patients",
  "https://www.pfizer.com/purpose/global-health",
  "https://www.pfizer.com/purpose/access",
  "https://www.pfizer.com/purpose/equity",
  "https://www.pfizer.com/purpose/community",

  "https://www.pfizer.com/people/leadership-team",
  "https://www.pfizer.com/people/board-of-directors",
  "https://www.pfizer.com/people/employees",
  "https://www.pfizer.com/people/careers",
  "https://www.pfizer.com/people/diversity",

  "https://www.pfizer.com/responsibility/environment",
  "https://www.pfizer.com/responsibility/sustainability",
  "https://www.pfizer.com/responsibility/governance",
  "https://www.pfizer.com/responsibility/compliance",
  "https://www.pfizer.com/responsibility/ethics",

  "https://www.pfizer.com/partners/collaborations",
  "https://www.pfizer.com/partners/licensing",
  "https://www.pfizer.com/partners/academic",
  "https://www.pfizer.com/partners/startups",
  "https://www.pfizer.com/partners/global",
  ];

  urls.forEach(url => stmt.run(url));
  stmt.finalize();

  console.log("Database created and URLs inserted.");
});

db.close();