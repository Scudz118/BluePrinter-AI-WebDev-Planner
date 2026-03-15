Developed as part of a team for the CXI + AI Design-to-Delivery Accelerator Challenge.

# BluePrinter
### AI-Assisted Web Development Planning Tool

BluePrinter is a prototype developed for the **CXI + AI Design-to-Delivery Accelerator Challenge** at the **University of Liverpool**.

The system demonstrates how AI can automate the early stages of the web development lifecycle by transforming a simple **project brief** into a **structured development workflow** aligned with existing company website styles.

---

# The Problem

Large organisations like **Pfizer** manage **thousands of websites across global markets**. Building and maintaining these sites often involves:

- duplicated development effort  
- inconsistent branding between pages  
- manual workflow planning  
- compliance issues discovered late in development  

As a result, scaling website delivery becomes **slow, expensive, and difficult to manage**.

---

# The Solution

BluePrinter helps teams move from **brief → development plan automatically**.

By combining **AI, website analysis, and workflow visualisation**, the system generates:

- recommended webpage layouts  
- development tasks for team members  
- structured project timelines  
- accessibility improvement suggestions  

This reduces repetitive work and helps teams build **consistent, compliant webpages faster**.

---

# Key Features

## Website Style Analysis
The system scans existing company websites stored in a database to detect common design patterns such as:

- colour palettes  
- fonts  
- layout structures  

This helps ensure generated pages follow **consistent brand styling**.

---

## AI Layout Generation
Using the project brief and detected design patterns, AI generates a **structured webpage layout** containing elements such as:

- headers  
- hero sections  
- content grids  
- card layouts  
- footers  

User instructions such as *“6 text boxes in a 2x3 grid”* are automatically interpreted and enforced.

---

## AI Task Planning
The generated layout is used to produce **role-based development tasks**.

Tasks are distributed across:

- team members  
- project days  

This creates a **structured development plan** for building the webpage.

---

## Accessibility Checks
When existing HTML is provided, BluePrinter performs basic accessibility analysis, including:

- detecting missing image **alt text**  
- identifying whether a page contains a **main H1 heading**

Future versions could extend this to include **WCAG compliance checks**.

---

## Workflow Timeline Visualisation
All generated tasks are displayed in an interactive **swim-lane timeline**, allowing teams to clearly see:

- who is responsible for each task  
- when tasks should be completed  
- daily project summaries  

This provides a **clear overview of the development workflow**.

---

# System Pipeline

BluePrinter transforms a simple project brief into a development workflow:

Project Brief -> Website Style Analysis -> AI Layout generation -> AI Task Planning -> Worfklow Timeline + Layout Preview



---

# Technology Used

### Frontend
- HTML
- CSS
- JavaScript

### Backend
- Node.js
- Express.js

### AI Integration
- OpenAI API

### Data & Analysis
- SQLite database
- Axios (web scraping)
- Cheerio (HTML parsing)

---

# How to Run the Project

### 1. Install dependencies
npm install


### 2. Create a `.env` file
OPENAI_API_KEY=your_api_key_here


### 3. Start the server
node server.js


### 4. Open the application
http://localhost:3000


---

# Future Improvements

Potential areas for development include:

- more advanced layout detection  
- deeper accessibility and compliance checks  
- real-time team collaboration features  
- integration with existing design systems and component libraries  

---

# Authors

Developed by:

- **Angela Baker**  
- **Hannah Couperthwaite**  
- **Lennon Richards**

University of Liverpool – **CXI + AI Hackathon**

---

# Project Purpose

This project was created as a **prototype demonstrating how AI can accelerate the web design and development lifecycle**, particularly in organisations managing **large web ecosystems**.
