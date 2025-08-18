Here’s a polished `README.md` tailored to your structure and the client-side part of the app. It explains setup, features, and usage clearly and includes best practices seen in modern full-stack project READMEs. Let me know if you'd like tweaks!

---

```markdown
# Ballooning App — React Frontend (Client)

This is the **React (Vite)** frontend for the *Ballooning App*, a full-stack tool that allows users to click-and-annotate (balloon) PDF drawings and generate a dimensional report by auto-filling a Word template.

---

##  Overview

- Display a drawing PDF using `react-pdf`
- Add numbered balloons with a single click
- Drag balloons to reposition
- Extract nearby text—especially numeric dimensions—for placeholders
- Send balloon data to the Flask backend for template mapping and DOCX generation
- Download the filled report

---

##  Folder Structure

```

client/
├─ package.json
├─ vite.config.js
└─ src/
├─ App.jsx
├─ api.js
├─ components/
│  ├─ PdfCanvas.jsx
│  ├─ BalloonOverlay.jsx
│  └─ MappingPanel.jsx
└─ styles.css

````

---

##  Getting Started

### Prerequisites

- Node.js (v18+)
- A running Flask backend serving at, for example, `http://localhost:5001` (ensure `upload`, `place_balloon`, `generate_doc` endpoints are available)

### Installation

In the `client` folder, run:

```bash
npm install
````

### Development

Start the frontend server with:

```bash
npm run dev
```

Frontend will be hosted at `http://localhost:5173` (or as shown in your terminal).

---

## Usage

1. Open the frontend in your browser (`http://localhost:5173`).
2. Upload the drawing PDF and the `.docx` (or `.doc`) template via the file inputs.
3. After upload, click anywhere on the drawing to add a balloon. You can drag it to adjust.
4. The app will suggest nearby numeric text values for each balloon—edit or confirm them in the side panel.
5. Click **Generate DOCX** to download a fully filled report with your mappings.

---

## Technical Highlights

* **PDF Viewer**: Uses `react-pdf` (which relies on `pdf.js`) and sets up the correct worker configuration for smooth rendering.
* **Balloon Overlay**: Implements absolute-positioned `<div>` elements over the PDF to mark annotations.
* **API Layer**: Includes convenient helper functions in `api.js` to integrate with backend routes like `/upload`, `/place_balloon`, and `/generate_doc`.
* **Mapping Panel**: UI for reviewing and adjusting balloon-to-placeholder assignments before generating the report.

---

## Styling & Customization

Styles are defined in `styles.css`:

* `.balloon`: Circle overlays representing numbers
* `.mapping-panel`: Sidebar layout for configuration
* `.viewer`, `.uploader`, `.content` — structured layout elements for UI clarity

You’re welcome to customize the look using CSS or a styling library like Tailwind, Material UI, or Styled Components.

---

## Next Steps

* **Auto-matching improvements**: Enhance logic to pull descriptions or spec values along with numeric matches.
* **OCR toggle UI**: Let users explicitly choose OCR fallback when PDF extraction fails.
* **Session management**: Save and load balloon states across sessions for multi-step reporting.
* **Docker support**: Bundle both client + server in Docker Compose for easy deployment.

---

## License & Contribution

Licensed under MIT. Feel free to contribute enhancements or report bugs via issues/pull requests if this becomes public or part of your team’s workflow.

Enjoy building your Balloning App frontend! Let me know if you'd like a README for the **server** portion next, or a combined root-level README to tie everything together!
