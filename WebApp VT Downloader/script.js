const input =
    document.querySelector("#urlInput");

const downloadButton =
    document.querySelector("#downloadButton");

const pasteButton =
    document.querySelector("#pasteButton");

const status =
    document.querySelector("#status");

const result =
    document.querySelector("#result");

const historyList =
    document.querySelector("#historyList");

const clearHistory =
    document.querySelector("#clearHistory");

let history =
    JSON.parse(
        localStorage.getItem("tiktokHistory")
    ) || [];

if (!Array.isArray(history)) {
    history = [];
}

downloadButton.textContent =
    "Cari Video";

pasteButton.addEventListener(
    "click",
    async function () {
        try {
            const text =
                await navigator.clipboard.readText();

            input.value = text;

            status.textContent =
                "Link berhasil ditempel.";

        } catch (error) {
            status.textContent =
                "Tidak bisa membaca clipboard. Gunakan Ctrl + V.";
        }
    }
);

function formatMB(bytes) {
    if (!bytes || bytes <= 0) {
        return "0.0";
    }

    return (
        bytes /
        1024 /
        1024
    ).toFixed(1);
}

function formatSpeed(bytesPerSecond) {
    if (
        !bytesPerSecond ||
        bytesPerSecond <= 0
    ) {
        return "0.0 MB/s";
    }

    return (
        bytesPerSecond /
        1024 /
        1024
    ).toFixed(1) + " MB/s";
}

function formatTime(seconds) {
    if (
        !isFinite(seconds) ||
        seconds < 0
    ) {
        return "Menghitung...";
    }

    seconds =
        Math.ceil(seconds);

    if (seconds < 60) {
        return `${seconds} detik`;
    }

    const minutes =
        Math.floor(
            seconds / 60
        );

    const remainingSeconds =
        seconds % 60;

    if (minutes < 60) {
        return `${minutes}m ${remainingSeconds}s`;
    }

    const hours =
        Math.floor(
            minutes / 60
        );

    const remainingMinutes =
        minutes % 60;

    return `${hours}j ${remainingMinutes}m`;
}

function sanitizeFilename(text) {
    if (!text) {
        return "tiktok-video";
    }

    return text
        .toString()
        .replace(
            /[<>:"/\\|?*]/g,
            ""
        )
        .replace(
            /\s+/g,
            " "
        )
        .trim()
        .slice(
            0,
            100
        ) || "tiktok-video";
}

function escapeHtml(text) {
    const div =
        document.createElement("div");

    div.textContent =
        text == null
            ? ""
            : String(text);

    return div.innerHTML;
}

function saveBlob(
    blob,
    filename
) {
    const blobUrl =
        URL.createObjectURL(blob);

    const link =
        document.createElement("a");

    link.href =
        blobUrl;

    link.download =
        filename;

    document.body.appendChild(link);

    link.click();

    link.remove();

    setTimeout(
        function () {
            URL.revokeObjectURL(blobUrl);
        },
        1000
    );
}

async function downloadFile(
    tiktokUrl,
    type,
    filename,
    button,
    normalText,
    progressBar,
    progressPercent,
    progressText
) {
    try {
        button.disabled = true;

        button.textContent =
            "Menyiapkan...";

        progressBar.style.width =
            "0%";

        progressPercent.textContent =
            "0%";

        progressText.innerHTML = `
            <span>
                0.0 MB / 0.0 MB
            </span>

            <span>
                Menyiapkan...
            </span>
        `;

        status.textContent =
            "Meminta file media terbaru...";

        const apiUrl =
            "/api/file-download?url=" +
            encodeURIComponent(tiktokUrl) +
            "&type=" +
            encodeURIComponent(type);

        console.log(
            "Download request:",
            apiUrl
        );

        const response =
            await fetch(apiUrl);

        if (!response.ok) {
            let message =
                "File gagal didownload.";

            try {
                const data =
                    await response.json();

                if (data.message) {
                    message =
                        data.message;
                }

            } catch (error) {}

            throw new Error(message);
        }

        const contentLength =
            response.headers.get(
                "content-length"
            );

        const total =
            parseInt(
                contentLength || "0",
                10
            );

        const contentType =
            response.headers.get(
                "content-type"
            ) || "video/mp4";

        if (!response.body) {
            const blob =
                await response.blob();

            saveBlob(
                blob,
                filename
            );

            progressBar.style.width =
                "100%";

            progressPercent.textContent =
                "100%";

            progressText.innerHTML = `
                <span>
                    ${formatMB(blob.size)} MB
                </span>

                <span>
                    Selesai
                </span>
            `;

            button.textContent =
                "✓ Download Berhasil";

            button.disabled =
                false;

            status.textContent =
                "File berhasil didownload.";

            return;
        }

        const reader =
            response.body.getReader();

        const chunks = [];

        let received = 0;

        const startTime =
            performance.now();

        let lastUpdate =
            startTime;

        let lastReceived =
            0;

        let speed = 0;

        while (true) {
            const {
                done,
                value
            } =
                await reader.read();

            if (done) {
                break;
            }

            if (!value) {
                continue;
            }

            chunks.push(value);

            received +=
                value.length;

            const now =
                performance.now();

            const interval =
                (
                    now -
                    lastUpdate
                ) / 1000;

            if (
                interval >= 0.25
            ) {
                const bytes =
                    received -
                    lastReceived;

                const instantSpeed =
                    bytes /
                    interval;

                speed =
                    speed === 0
                        ? instantSpeed
                        :
                        (
                            speed * 0.7
                        ) +
                        (
                            instantSpeed * 0.3
                        );

                lastUpdate =
                    now;

                lastReceived =
                    received;
            }

            if (total > 0) {
                const percent =
                    Math.min(
                        100,
                        Math.round(
                            (
                                received /
                                total
                            ) * 100
                        )
                    );

                const currentMB =
                    formatMB(received);

                const totalMB =
                    formatMB(total);

                const remaining =
                    Math.max(
                        0,
                        total -
                        received
                    );

                const eta =
                    speed > 0
                        ? remaining / speed
                        : Infinity;

                progressBar.style.width =
                    percent + "%";

                progressPercent.textContent =
                    percent + "%";

                progressText.innerHTML = `
                    <span>
                        ${currentMB} MB / ${totalMB} MB
                    </span>

                    <span>
                        ${formatSpeed(speed)}
                        •
                        ${formatTime(eta)}
                    </span>
                `;

                button.textContent =
                    `Downloading ${percent}%`;

                status.textContent =
                    `Download ${percent}% — ${currentMB} MB / ${totalMB} MB — ${formatSpeed(speed)}`;

            } else {
                const currentMB =
                    formatMB(received);

                progressBar.style.width =
                    "100%";

                progressPercent.textContent =
                    "—";

                progressText.innerHTML = `
                    <span>
                        ${currentMB} MB
                    </span>

                    <span>
                        ${formatSpeed(speed)}
                        • Ukuran tidak diketahui
                    </span>
                `;

                button.textContent =
                    `Downloading ${currentMB} MB`;
            }
        }

        const blob =
            new Blob(
                chunks,
                {
                    type:
                        contentType
                }
            );

        saveBlob(
            blob,
            filename
        );

        progressBar.style.width =
            "100%";

        progressPercent.textContent =
            "100%";

        progressText.innerHTML = `
            <span>
                ${formatMB(received)} MB
                ${
                    total > 0
                        ? "/ " +
                          formatMB(total) +
                          " MB"
                        : ""
                }
            </span>

            <span>
                Selesai
            </span>
        `;

        button.textContent =
            "✓ Download Berhasil";

        button.disabled =
            false;

        status.textContent =
            "File berhasil didownload.";

    } catch (error) {
        console.error(
            "Download error:",
            error
        );

        button.disabled =
            false;

        button.textContent =
            normalText;

        progressBar.style.width =
            "0%";

        progressPercent.textContent =
            "0%";

        progressText.innerHTML = `
            <span>
                Download gagal
            </span>

            <span>
                ${escapeHtml(
                    error.message ||
                    "Coba lagi"
                )}
            </span>
        `;

        status.textContent =
            error.message ||
            "Gagal mendownload file.";
    }
}

async function searchVideo() {
    const url =
        input.value.trim();

    result.innerHTML =
        "";

    if (!url) {
        status.textContent =
            "Masukkan link TikTok terlebih dahulu.";

        return;
    }

    let parsed;

    try {
        parsed =
            new URL(url);

    } catch {
        status.textContent =
            "Link tidak valid.";

        return;
    }

    const hostname =
        parsed.hostname.toLowerCase();

    if (
        hostname !== "tiktok.com" &&
        !hostname.endsWith(".tiktok.com")
    ) {
        status.textContent =
            "Link yang dimasukkan bukan link TikTok.";

        return;
    }

    status.textContent =
        "Mencari video...";

    downloadButton.disabled =
        true;

    downloadButton.innerHTML = `
        <span class="spinner"></span>
        Mencari...
    `;

    try {
        const response =
            await fetch(
                "/api/download",
                {
                    method:
                        "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            url: url
                        })
                }
            );

        const data =
            await response.json();

        console.log(
            "DATA SERVER:",
            data
        );

        if (
            !response.ok ||
            !data.success
        ) {
            throw new Error(
                data.message ||
                "Video tidak ditemukan."
            );
        }

        saveHistory(url);

        status.textContent =
            "Video ditemukan!";

        let buttons =
            "";

        if (data.hasVideo) {
            buttons += `
                <button
                    type="button"
                    id="downloadVideoButton"
                    class="download-video-button"
                >
                    Download Video
                </button>
            `;
        }

        if (data.hasHd) {
            buttons += `
                <button
                    type="button"
                    id="downloadHdButton"
                    class="download-video-button"
                >
                    Download HD
                </button>
            `;
        }

        if (!buttons) {
            buttons = `
                <button
                    type="button"
                    class="download-video-button"
                    disabled
                >
                    Download Tidak Tersedia
                </button>
            `;
        }

        let preview =
            "";

        if (data.hasVideo) {
            preview = `
                <video
                    class="video-preview"
                    controls
                    preload="metadata"
                    poster="${escapeHtml(
                        data.thumbnail
                    )}"
                    src="/api/file-download?url=${encodeURIComponent(
                        url
                    )}&type=video"
                >
                    Browser kamu tidak mendukung video.
                </video>
            `;
        } else if (data.thumbnail) {
            preview = `
                <img
                    src="${escapeHtml(
                        data.thumbnail
                    )}"
                    alt="Thumbnail video"
                    class="thumbnail"
                >
            `;
        }

        result.innerHTML = `
            <div class="video-result">

                <div class="video-badge">
                    VIDEO DITEMUKAN
                </div>

                ${preview}

                <div class="video-info">

                    <h3>
                        ${escapeHtml(
                            data.title ||
                            "Video TikTok"
                        )}
                    </h3>

                    <p class="creator">
                        Creator:

                        <strong>
                            ${escapeHtml(
                                data.author ||
                                "Tidak diketahui"
                            )}
                        </strong>
                    </p>

                </div>

                <div
                    class="download-progress-wrapper"
                >

                    <div
                        class="download-progress-header"
                    >

                        <span>
                            Download
                        </span>

                        <span
                            id="downloadProgressPercent"
                        >
                            0%
                        </span>

                    </div>

                    <div
                        class="download-progress-container"
                    >

                        <div
                            id="downloadProgressBar"
                            class="download-progress-bar"
                        ></div>

                    </div>

                    <div
                        id="downloadProgressText"
                        class="download-progress-info"
                    >

                        <span>
                            0.0 MB / 0.0 MB
                        </span>

                        <span>
                            Menunggu...
                        </span>

                    </div>

                </div>

                <div class="actions">

                    ${buttons}

                    <a
                        href="${escapeHtml(url)}"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="open-button"
                    >
                        Buka Video
                    </a>

                    <button
                        type="button"
                        id="copyButton"
                        class="copy-button"
                    >
                        Salin Link
                    </button>

                </div>

            </div>
        `;

        const progressBar =
            document.querySelector(
                "#downloadProgressBar"
            );

        const progressPercent =
            document.querySelector(
                "#downloadProgressPercent"
            );

        const progressText =
            document.querySelector(
                "#downloadProgressText"
            );

        const videoButton =
            document.querySelector(
                "#downloadVideoButton"
            );

        const hdButton =
            document.querySelector(
                "#downloadHdButton"
            );

        if (videoButton) {
            videoButton.addEventListener(
                "click",
                function () {
                    downloadFile(
                        url,
                        "video",
                        sanitizeFilename(
                            data.title
                        ) + ".mp4",
                        videoButton,
                        "Download Video",
                        progressBar,
                        progressPercent,
                        progressText
                    );
                }
            );
        }

        if (hdButton) {
            hdButton.addEventListener(
                "click",
                function () {
                    downloadFile(
                        url,
                        "hd",
                        sanitizeFilename(
                            data.title
                        ) + "-HD.mp4",
                        hdButton,
                        "Download HD",
                        progressBar,
                        progressPercent,
                        progressText
                    );
                }
            );
        }

        const copyButton =
            document.querySelector(
                "#copyButton"
            );

        if (copyButton) {
            copyButton.addEventListener(
                "click",
                async function () {
                    try {
                        await navigator.clipboard.writeText(
                            url
                        );

                        copyButton.textContent =
                            "✓ Link Disalin!";

                        status.textContent =
                            "Link berhasil disalin.";

                        setTimeout(
                            function () {
                                copyButton.textContent =
                                    "Salin Link";
                            },
                            1500
                        );

                    } catch {
                        status.textContent =
                            "Gagal menyalin link.";
                    }
                }
            );
        }

    } catch (error) {
        console.error(
            "Search error:",
            error
        );

        status.textContent =
            error.message ||
            "Tidak dapat terhubung ke server.";

    } finally {
        downloadButton.disabled =
            false;

        downloadButton.textContent =
            "Cari Video";
    }
}

downloadButton.addEventListener(
    "click",
    searchVideo
);

input.addEventListener(
    "keydown",
    function (event) {
        if (event.key === "Enter") {
            searchVideo();
        }
    }
);

function saveHistory(url) {
    history =
        history.filter(
            item =>
                item !== url
        );

    history.unshift(url);

    history =
        history.slice(
            0,
            10
        );

    localStorage.setItem(
        "tiktokHistory",
        JSON.stringify(history)
    );

    displayHistory();
}

function displayHistory() {
    if (history.length === 0) {
        historyList.innerHTML = `
            <div class="history-empty">
                Belum ada riwayat pencarian.
            </div>
        `;

        return;
    }

    historyList.innerHTML =
        history
            .map(
                url => `
                    <div class="history-item">

                        <div class="history-url">
                            ${escapeHtml(url)}
                        </div>

                        <button
                            type="button"
                            class="history-open"
                            data-url="${escapeHtml(url)}"
                        >
                            Cari Lagi
                        </button>

                    </div>
                `
            )
            .join("");

    document
        .querySelectorAll(
            ".history-open"
        )
        .forEach(
            button => {
                button.addEventListener(
                    "click",
                    function () {
                        input.value =
                            this.dataset.url;

                        searchVideo();
                    }
                );
            }
        );
}

clearHistory.addEventListener(
    "click",
    function () {
        history = [];

        localStorage.removeItem(
            "tiktokHistory"
        );

        displayHistory();

        status.textContent =
            "Riwayat berhasil dihapus.";
    }
);

displayHistory();
