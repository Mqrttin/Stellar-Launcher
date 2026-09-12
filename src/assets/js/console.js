const { ipcRenderer } = require("electron");

const output = document.getElementById("console-output");
const logCount = document.getElementById("log-count");
const consoleTime = document.getElementById("console-time");
const clearButton = document.getElementById("clear-console");
const minimizeButton = document.getElementById("minimize-console");
const closeButton = document.getElementById("close-console");
const filters = document.querySelectorAll(".console-filter");

let logs = [];
let currentFilter = "all";

function getTime() {
    const now = new Date();

    return [
        String(now.getHours()).padStart(2, "0"),
        String(now.getMinutes()).padStart(2, "0"),
        String(now.getSeconds()).padStart(2, "0")
    ].join(":");
}

function updateClock() {
    consoleTime.textContent = getTime();
}

function normalizeType(type) {
    const value = String(type || "info").toLowerCase();

    if (["info", "download", "success", "warn", "error"].includes(value)) {
        return value;
    }

    return "info";
}

function addLog(data) {
    if (!data) return;

    logs.push({
        type: normalizeType(data.type),
        name: data.name ? `[${data.name}] ` : "",
        message: String(data.message ?? ""),
        time: data.time || getTime()
    });

    renderLogs();
}

function renderLogs() {
    const filteredLogs = currentFilter === "all"
        ? logs
        : logs.filter(log => log.type === currentFilter);

    output.innerHTML = "";

    if (!filteredLogs.length) {
        output.innerHTML = `
            <div class="console-empty">
                <div class="console-empty-icon">
                    <svg viewBox="0 0 24 24">
                        <path d="M4 5h16v14H4V5zm2 2v10h12V7H6zm2 2h2v2H8V9zm4 0h4v2h-4V9zm-4 4h8v2H8v-2z"/>
                    </svg>
                </div>
                <h2>STELLAR CONSOLE</h2>
                <p>Esperando registros del launcher...</p>
            </div>
        `;

        logCount.textContent = "0";
        return;
    }

    filteredLogs.forEach(log => {
        const row = document.createElement("div");

        row.className = `console-log ${log.type}`;

        row.innerHTML = `
            <div class="console-log-time">${escapeHtml(log.time)}</div>
            <div class="console-log-type">${escapeHtml(log.type.toUpperCase())}</div>
            <div class="console-log-message">
                <span class="log-source">${escapeHtml(log.name)}</span>${escapeHtml(log.message)}
            </div>
        `;

        output.appendChild(row);
    });

    logCount.textContent = filteredLogs.length;

    requestAnimationFrame(() => {
        output.scrollTop = output.scrollHeight;
    });
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function clearConsole() {
    logs = [];
    renderLogs();
}

filters.forEach(filter => {
    filter.addEventListener("click", () => {
        filters.forEach(button => {
            button.classList.remove("active");
        });

        filter.classList.add("active");

        currentFilter = filter.dataset.filter;

        renderLogs();
    });
});

ipcRenderer.on("stellar-console-log", (event, data) => {
    addLog(data);
});

clearButton.addEventListener("click", () => {
    clearConsole();
});

minimizeButton.addEventListener("click", () => {
    ipcRenderer.send("console-minimize");
});

closeButton.addEventListener("click", () => {
    ipcRenderer.send("console-close");
});

setInterval(updateClock, 1000);

updateClock();
renderLogs();