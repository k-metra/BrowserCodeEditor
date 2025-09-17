// UTILITIES
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const out = $("#output");
const preview = $("#preview");

const STORAGE_KEY = "ccs-web";

const escapeHtml = s => 
    String(s).replace(/[&<>""]/g, c => ({
        '&': "&amp;",
        '<': "&lt;",
        '>': "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[c]
));

function log(msg, type='info') {
    const color = type === 'error' ? 'var(--err)' : type === 'warn' ? 'var(--warn)' : 'var(--brand)';

    const time = new Date().toLocaleTimeString();

    const line = document.createElement("div");
    line.innerHTML = `<span style="color: ${color}">[${time}]</span> ${escapeHtml(msg)}`;
    out.appendChild(line);
    out.scrollTop = out.scrollHeight;
}

$("#clearOut").addEventListener("click", () => {
    out.innerHTML = '';
    console.log("Cleared output.")
});

const makeEditor = (id, mode) => {
    const ed = ace.edit(id, {
        theme: "ace/theme/dracula",
        mode, tabSize: 4, useSoftTabs: true, showPrintMargin: false, wrap: false
    });

    ed.session.setUseWrapMode(true);

    ed.commands.addCommand({
        name: "run",
        bindKey: {win: "Ctrl-Enter", mac: "Command-Enter"},
        exec() { runWeb(false);}
    });

    ed.commands.addCommand({
        name: "save",
        bindKey: {win: "Ctrl-S", mac: "Command-S"},
        exec() { saveProject(); }
    })

    return ed;
}

const ed_html = makeEditor("ed_html", "ace/mode/html");
const ed_css = makeEditor("ed_css", "ace/mode/css");
const ed_js = makeEditor("ed_js", "ace/mode/javascript");

const TAB_ORDER = ["html", "css", "js"];
const wraps = Object.fromEntries($$("#webEditors .editor-wrap").map(w => [w.dataset.pane, w]));

const editors = {
    html: ed_html,
    css: ed_css,
    js: ed_js
};

const activePane = () => {
    const t = $("#webTabs .tab.active");
    return t ? t.dataset.pane : "html";
};

const showPane = (name) => {

    TAB_ORDER.forEach(k => {
        if (wraps[k]) {
            wraps[k].hidden = (k !== name); 
            }
        })

    $$("#webTabs .tab").forEach(t => {
        const on = t.dataset.pane === name;
        t.classList.toggle("active", on)
        t.setAttribute("aria-selected", on);
        t.tabIndex = on ? 0 : -1;
    });

    requestAnimationFrame(() => {
        const ed = editors[name];

        if (ed && ed.resize) {
            console.log("Editor found");
            ed.resize(true);
            ed.focus();
        }
    });
};

$("#webTabs")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab");

    if (!btn) return;

    showPane(btn.dataset.pane);
});

$("webTabs")?.addEventListener("keydown", (e) => {
    const index = TAB_ORDER.indexOf(activePane());
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const delta = e.key === "ArrowLeft" ? -1 : 1;
        let newIndex = (index + delta + TAB_ORDER.length) % TAB_ORDER.length;
        showPane(TAB_ORDER[newIndex]);
        e.preventDefault();
    }
});

showPane("html");

const buildWebSrcDoc = (withTests=false) => {
    const html = ed_html.getValue();
    const css = ed_css.getValue();
    const js = ed_js.getValue();
    const tests = ($("#testArea")?.value || '').trim();

    return `
    <!DOCTYPE html>
    <html lang="en" dir="ltr">

    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            ${css}\n
        </style>
        <body>
            ${html}

            <script>
                try {
                    ${js}
                    ${withTests && tests ? `\n/* tests */\n${tests}` : ''}
                } catch (e) {
                    console.error(e);
                }
            <\/script>
        </body>
    </head>
    </html>
    `;

}

const runWeb = (withTests=false) => {
    preview.srcdoc = buildWebSrcDoc(withTests);
    log(withTests ? "Run with tests" : "Web preview updated.");
}

$("#runWeb")?.addEventListener("click", () => runWeb());
$("#runTests")?.addEventListener("click", () => runWeb(true));
$("#openPreview")?.addEventListener("click", () => {
    const src = buildWebSrcDoc(false);
    const w = window.open("about:blank");

    w.document.open();
    w.document.write(src)
    w.document.close();
});

const projectJson = () => {
    return {
        version: 1,
        kind: 'web-only',
        assignment: $("#assignment")?.value || "",
        test: $("#testArea")?.value || "",
        html: ed_html.getValue(),
        css: ed_css.getValue(),
        js: ed_js.getValue(),
    };
};

const loadProject = (obj) => {
    try {
        if ($('#assignment')) $('#assignment').value = obj.assignment;

        if ($('#testArea')) $('#testArea').value = obj.test;

        ed_html.setValue(obj.html || "", -1);
        ed_css.setValue(obj.css || "", -1);
        ed_js.setValue(obj.js || "", -1);

        log("Web project loaded.")
    } catch (Exception) {
        log("Failed to load project: " + Exception, 'error');
    }
}

const setDefaultContent = () => {
    ed_html.setValue(`<!-- Write your html code here -->`);
    ed_css.setValue(`/* Write your CSS code here */`)
    ed_js.setValue(`// Write your JavaScript code here`);
};

const saveProject = () => {
    try {
        const data = JSON.stringify(projectJson(), null, 2);
        localStorage.setItem(STORAGE_KEY, data);

        const blob = new Blob([data], {type: 'application/json'});
        const a = document.createElement("a")
        a.href = URL.createObjectURL(blob);
        a.download = "ccs-academy-web.json";
        a.click();
        log("Saved locally and downloaded project.")
    } catch (Exception) {
        console.error(Exception);
    }
}

$("#saveBtn")?.addEventListener("click", saveProject);
$("#loadBtn")?.addEventListener("click", () => $("#openFile").click());
$("openFile")?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    try {
        const obj = JSON.parse(await file.text());
        loadProject(obj);
    } catch (Exception) {
        log("Invalid project file: " + Exception, 'error');
    }
});

try {
    const cache = localStorage.getItem(STORAGE_KEY);
    if (cache) {
        loadProject(JSON.parse(cache));
    } else {
        setDefaultContent();
    }
} catch (Exception) {
    setDefaultContent();
}

log("Ready - Web Only Editor (HTML/CSS/JS)")