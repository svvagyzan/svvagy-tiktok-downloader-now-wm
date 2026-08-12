const express = require("express");
const path = require("path");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

const webFolder = path.join(
    __dirname,
    "WebApp VT Downloader"
);

app.use(express.json());
app.use(express.static(webFolder));

app.get("/", (req, res) => {
    res.sendFile(
        path.join(
            webFolder,
            "index.html"
        )
    );
});

app.get("/api/test", (req, res) => {
    res.json({
        success: true,
        message: "Backend berhasil terhubung!"
    });
});

function isTikTokUrl(url) {
    try {
        const parsed = new URL(url);
        const hostname = parsed.hostname.toLowerCase();

        return (
            hostname === "tiktok.com" ||
            hostname.endsWith(".tiktok.com")
        );
    } catch {
        return false;
    }
}

async function getTikWMData(url) {
    const response = await axios.post(
        "https://www.tikwm.com/api/",
        new URLSearchParams({
            url: url,
            count: 12,
            cursor: 0,
            web: 1,
            hd: 1
        }).toString(),
        {
            headers: {
                "Content-Type":
                    "application/x-www-form-urlencoded; charset=UTF-8",

                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151.0.0.0 Safari/537.36",

                "Accept":
                    "application/json,text/plain,*/*",

                "Origin":
                    "https://www.tikwm.com",

                "Referer":
                    "https://www.tikwm.com/"
            },

            timeout: 30000
        }
    );

    const data = response.data;

    console.log(
        "TikWM response code:",
        data?.code
    );

    if (
        !data ||
        data.code !== 0 ||
        !data.data
    ) {
        throw new Error(
            data?.msg ||
            "Data video tidak ditemukan."
        );
    }

    return data.data;
}

function getMediaUrl(videoData, type) {
    if (!videoData) {
        return null;
    }

    if (type === "hd") {
        return (
            videoData.hdplay ||
            videoData.play ||
            null
        );
    }

    return (
        videoData.play ||
        null
    );
}

function normalizeMediaUrl(value) {
    console.log(
        "Raw media value:",
        value
    );

    console.log(
        "Raw media type:",
        typeof value
    );

    if (
        value === null ||
        value === undefined
    ) {
        return null;
    }

    if (
        typeof value !== "string"
    ) {
        return null;
    }

    const mediaValue =
        value.trim();

    if (!mediaValue) {
        return null;
    }

    try {
        const mediaUrl =
            new URL(
                mediaValue,
                "https://www.tikwm.com"
            );

        if (
            mediaUrl.protocol !== "http:" &&
            mediaUrl.protocol !== "https:"
        ) {
            return null;
        }

        console.log(
            "Normalized media URL:",
            mediaUrl.href
        );

        return mediaUrl.href;

    } catch (error) {
        console.error(
            "Gagal membuat media URL:",
            error.message
        );

        return null;
    }
}

function sanitizeFilename(text) {
    if (!text) {
        return "tiktok-video";
    }

    let name = text
        .toString()
        .normalize("NFKD")
        .replace(
            /[\u0300-\u036f]/g,
            ""
        )
        .replace(
            /[<>:"/\\|?*\x00-\x1F]/g,
            ""
        )
        .replace(
            /[^\x20-\x7E]/g,
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
        );

    if (!name) {
        name = "tiktok-video";
    }

    return name;
}

function getFilename(title, type) {
    const name =
        sanitizeFilename(title);

    if (type === "hd") {
        return (
            name +
            "-HD.mp4"
        );
    }

    return (
        name +
        ".mp4"
    );
}

app.post(
    "/api/download",
    async (req, res) => {
        try {
            const {
                url
            } = req.body;

            if (!url) {
                return res.status(
                    400
                ).json({
                    success: false,
                    message:
                        "URL TikTok belum diberikan."
                });
            }

            if (
                !isTikTokUrl(url)
            ) {
                return res.status(
                    400
                ).json({
                    success: false,
                    message:
                        "URL bukan URL TikTok."
                });
            }

            console.log(
                "Mencari TikTok:",
                url
            );

            const videoData =
                await getTikWMData(
                    url
                );

            console.log(
                "Data video berhasil didapat."
            );

            res.json({
                success: true,

                title:
                    videoData.title ||
                    "Video TikTok",

                author:
                    videoData.author?.nickname ||
                    "Tidak diketahui",

                thumbnail:
                    videoData.cover ||
                    "",

                hasVideo:
                    !!videoData.play,

                hasHd:
                    !!videoData.hdplay
            });

        } catch (error) {
            console.error(
                "Search error:",
                error.response?.data ||
                error.message
            );

            res.status(
                500
            ).json({
                success: false,
                message:
                    error.message ||
                    "Gagal mengambil data video."
            });
        }
    }
);

app.get(
    "/api/file-download",
    async (req, res) => {
        try {
            const {
                url,
                type
            } = req.query;

            if (!url) {
                return res.status(
                    400
                ).json({
                    success: false,
                    message:
                        "URL TikTok belum diberikan."
                });
            }

            if (
                !isTikTokUrl(url)
            ) {
                return res.status(
                    400
                ).json({
                    success: false,
                    message:
                        "URL TikTok tidak valid."
                });
            }

            const mediaType =
                type === "hd"
                    ? "hd"
                    : "video";

            console.log(
                "================================="
            );

            console.log(
                "Meminta data media..."
            );

            console.log(
                "TikTok URL:",
                url
            );

            console.log(
                "Media type:",
                mediaType
            );

            const videoData =
                await getTikWMData(
                    url
                );

            const rawMediaUrl =
                getMediaUrl(
                    videoData,
                    mediaType
                );

            const mediaUrl =
                normalizeMediaUrl(
                    rawMediaUrl
                );

            if (!mediaUrl) {
                console.error(
                    "Provider tidak memberikan URL media yang valid."
                );

                return res.status(
                    502
                ).json({
                    success: false,
                    message:
                        "Provider tidak memberikan URL video yang valid."
                });
            }

            console.log(
                "Fresh media URL berhasil didapat."
            );

            console.log(
                "Media URL valid:",
                mediaUrl
            );

            const mediaResponse =
                await axios.get(
                    mediaUrl,
                    {
                        responseType:
                            "stream",

                        maxRedirects:
                            10,

                        timeout:
                            60000,

                        headers: {
                            "User-Agent":
                                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151.0.0.0 Safari/537.36",

                            "Accept":
                                "*/*",

                            "Referer":
                                "https://www.tikwm.com/",

                            "Origin":
                                "https://www.tikwm.com",

                            "Connection":
                                "keep-alive"
                        },

                        validateStatus:
                            () => true
                    }
                );

            console.log(
                "Media response status:",
                mediaResponse.status
            );

            if (
                mediaResponse.status < 200 ||
                mediaResponse.status >= 300
            ) {
                if (
                    mediaResponse.data &&
                    typeof mediaResponse.data.destroy ===
                        "function"
                ) {
                    mediaResponse.data.destroy();
                }

                if (
                    mediaResponse.status === 403
                ) {
                    return res.status(
                        403
                    ).json({
                        success: false,
                        message:
                            "Server media menolak akses ke file."
                    });
                }

                if (
                    mediaResponse.status === 404
                ) {
                    return res.status(
                        404
                    ).json({
                        success: false,
                        message:
                            "File video sudah tidak tersedia."
                    });
                }

                return res.status(
                    mediaResponse.status
                ).json({
                    success: false,
                    message:
                        "Media tidak dapat diakses."
                });
            }

            let contentType =
                mediaResponse
                    .headers[
                        "content-type"
                    ] ||
                "application/octet-stream";

            if (
                !contentType.includes(
                    "video"
                )
            ) {
                contentType =
                    "video/mp4";
            }

            const contentLength =
                mediaResponse
                    .headers[
                        "content-length"
                    ];

            const filename =
                getFilename(
                    videoData.title,
                    mediaType
                );

            const encodedFilename =
                encodeURIComponent(
                    filename
                );

            res.status(200);

            res.setHeader(
                "Content-Type",
                contentType
            );

            if (
                contentLength
            ) {
                res.setHeader(
                    "Content-Length",
                    contentLength
                );
            }

            res.setHeader(
                "Content-Disposition",
                `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`
            );

            res.setHeader(
                "Cache-Control",
                "no-cache"
            );

            res.setHeader(
                "X-Content-Type-Options",
                "nosniff"
            );

            mediaResponse.data.on(
                "error",
                error => {
                    console.error(
                        "Media stream error:",
                        error.message
                    );

                    if (
                        !res.headersSent
                    ) {
                        res.status(
                            500
                        ).json({
                            success: false,
                            message:
                                "Stream media gagal."
                        });
                    } else {
                        res.destroy();
                    }
                }
            );

            req.on(
                "close",
                () => {
                    if (
                        !res.writableEnded
                    ) {
                        mediaResponse
                            .data
                            .destroy();
                    }
                }
            );

            mediaResponse
                .data
                .pipe(res);

        } catch (error) {
            console.error(
                "File download error:",
                error.message
            );

            if (
                error.response
            ) {
                console.error(
                    "HTTP status:",
                    error.response.status
                );
            }

            if (
                !res.headersSent
            ) {
                res.status(
                    500
                ).json({
                    success: false,
                    message:
                        error.message ||
                        "Gagal mengambil file video."
                });
            } else {
                res.destroy();
            }
        }
    }
);

app.listen(
    PORT,
    () => {
        console.log(
            "================================="
        );

        console.log(
            `Server berjalan di http://localhost:${PORT}`
        );

        console.log(
            "================================="
        );
    }
);