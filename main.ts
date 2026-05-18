import { Plugin, Modal, Notice, TFile, App, PluginSettingTab, Setting, ItemView, WorkspaceLeaf } from "obsidian";

interface VideoRecordManagerSettings {
    enableHideWatched: boolean;
    hideWatchedDays: number;
    enableAutoUpdate: boolean;
}

const DEFAULT_SETTINGS: VideoRecordManagerSettings = {
    enableHideWatched: true,
    hideWatchedDays: 7,
    enableAutoUpdate: true
};

// Helper to format Date as "YYYY-MM-DD"
function formatDate(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

// Helper to format Date as "YYYY-MM-DD HH:mm"
function formatDateTime(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

// Helper to sanitize filenames by removing forbidden OS/Obsidian characters
function sanitizeFilename(name: string): string {
    return name.replace(/[\\/:*?"<>|]/g, "").trim();
}

// Helper to sanitize and format season/episode strings (e.g., "1" -> "01")
function sanitizeNumberStr(val: string): string {
    const clean = val.replace(/[\\/:*?"<>|]/g, "").trim();
    if (/^\d+$/.test(clean)) {
        return clean.padStart(2, "0");
    }
    return clean;
}

// Helper to escape double quotes for frontmatter properties
function escapeYamlString(str: string): string {
    return str.replace(/"/g, '\\"');
}

// Custom Add Video Modal Class
class AddVideoModal extends Modal {
    onSubmit: (result: {
        title: string;
        type: "Movie" | "Drama" | "Anime";
        director: string;
        seriesName: string;
        season: string;
        episode: string;
        genre: string;
        subgenre: string;
        status: string;
        rating: number;
    }) => void;

    // Data structures for auto-suggest
    uniqueSeries: Map<string, { director: string; genre: string; subgenre: string; type: "Movie" | "Drama" | "Anime"; maxSeasonNum: number; maxEpisodeNum: number; maxSeasonStr: string; maxEpisodeStr: string }> = new Map();
    uniqueDirectors: Set<string> = new Set();
    uniqueGenres: Set<string> = new Set();
    uniqueSubgenres: Set<string> = new Set();

    constructor(app: App, onSubmit: (result: any) => void) {
        super(app);
        this.onSubmit = onSubmit;
        this.scanExistingVideos();
    }

    scanExistingVideos() {
        const files = this.app.vault.getMarkdownFiles();
        for (const file of files) {
            const cache = this.app.metadataCache.getFileCache(file);
            const frontmatter = cache?.frontmatter;
            if (!frontmatter) continue;

            const isInVideosFolder = file.path.startsWith("Videos/");

            if (isInVideosFolder) {
                const director = frontmatter.director || "";
                const series = frontmatter.series || "";
                const season = frontmatter.season || "";
                const episode = frontmatter.episode || "";
                const genre = frontmatter.genre || "";
                const subgenre = frontmatter.subgenre || "";
                const type = frontmatter.type || "Movie";

                if (director && director.trim()) {
                    this.uniqueDirectors.add(director.trim());
                }

                if (genre && genre.trim()) {
                    this.uniqueGenres.add(genre.trim());
                }

                if (subgenre && subgenre.trim()) {
                    this.uniqueSubgenres.add(subgenre.trim());
                }

                if (series && series.trim()) {
                    const seriesKey = series.trim();
                    const cleanDirector = director ? director.trim() : "";
                    const cleanGenre = genre ? genre.trim() : "";
                    const cleanSubgenre = subgenre ? subgenre.trim() : "";

                    // Extract numbers for season and episode comparison
                    const seasonDigits = String(season).replace(/\D/g, "");
                    const seasonNum = seasonDigits ? parseInt(seasonDigits, 10) : NaN;

                    const epDigits = String(episode).replace(/\D/g, "");
                    const epNum = epDigits ? parseInt(epDigits, 10) : NaN;

                    const existing = this.uniqueSeries.get(seriesKey);
                    if (existing) {
                        // We check if this is a newer episode
                        let isNewer = false;
                        if (!isNaN(seasonNum)) {
                            if (isNaN(existing.maxSeasonNum) || seasonNum > existing.maxSeasonNum) {
                                isNewer = true;
                            } else if (seasonNum === existing.maxSeasonNum && !isNaN(epNum)) {
                                if (isNaN(existing.maxEpisodeNum) || epNum > existing.maxEpisodeNum) {
                                    isNewer = true;
                                }
                            }
                        }

                        if (isNewer) {
                            existing.maxSeasonNum = isNaN(seasonNum) ? -1 : seasonNum;
                            existing.maxEpisodeNum = isNaN(epNum) ? -1 : epNum;
                            existing.maxSeasonStr = String(season);
                            existing.maxEpisodeStr = String(episode);
                        }

                        if (!existing.director && cleanDirector) existing.director = cleanDirector;
                        if (!existing.genre && cleanGenre) existing.genre = cleanGenre;
                        if (!existing.subgenre && cleanSubgenre) existing.subgenre = cleanSubgenre;
                    } else {
                        this.uniqueSeries.set(seriesKey, {
                            director: cleanDirector,
                            genre: cleanGenre,
                            subgenre: cleanSubgenre,
                            type: type,
                            maxSeasonNum: isNaN(seasonNum) ? -1 : seasonNum,
                            maxEpisodeNum: isNaN(epNum) ? -1 : epNum,
                            maxSeasonStr: String(season),
                            maxEpisodeStr: String(episode)
                        });
                    }
                }
            }
        }
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.addClass("vrm-modal");

        // Modal Title
        contentEl.createEl("h2", { text: "🎬 Add New Video Entry", cls: "vrm-modal-title" });

        // Form Container
        const form = contentEl.createDiv({ cls: "vrm-form" });

        // Content Type Row
        const typeGroup = form.createDiv({ cls: "vrm-field-group" });
        typeGroup.createEl("label", { text: "Content Type" });
        const typeSelect = typeGroup.createEl("select", { cls: "vrm-select" });
        typeSelect.createEl("option", { text: "Movie (映画)", value: "Movie" });
        typeSelect.createEl("option", { text: "Drama (ドラマ)", value: "Drama" });
        typeSelect.createEl("option", { text: "Anime (アニメ)", value: "Anime" });

        // Series and Episode Side-by-Side row (Drama/Anime only, initially disabled/hidden)
        const seriesRow = form.createDiv({ cls: "vrm-row", attr: { style: "display: none;" } });

        // Series Field
        const seriesGroup = seriesRow.createDiv({ cls: "vrm-field-group" });
        seriesGroup.createEl("label", { text: "Series / Show Title *" });
        const seriesInput = seriesGroup.createEl("input", {
            type: "text",
            cls: "vrm-input",
            placeholder: "e.g., Breaking Bad"
        });
        seriesInput.setAttribute("id", "vrm-input-series");
        seriesInput.setAttribute("autocomplete", "off");

        // Season Field
        const seasonGroup = seriesRow.createDiv({ cls: "vrm-field-group", attr: { style: "max-width: 80px;" } });
        seasonGroup.createEl("label", { text: "Season" });
        const seasonInput = seasonGroup.createEl("input", {
            type: "text",
            cls: "vrm-input",
            placeholder: "e.g., 01"
        });
        seasonInput.setAttribute("id", "vrm-input-season");
        seasonInput.setAttribute("autocomplete", "off");

        // Episode Field
        const episodeGroup = seriesRow.createDiv({ cls: "vrm-field-group", attr: { style: "max-width: 80px;" } });
        episodeGroup.createEl("label", { text: "Episode" });
        const episodeInput = episodeGroup.createEl("input", {
            type: "text",
            cls: "vrm-input",
            placeholder: "e.g., 01"
        });
        episodeInput.setAttribute("id", "vrm-input-episode");
        episodeInput.setAttribute("autocomplete", "off");

        // Video Title Field
        const titleGroup = form.createDiv({ cls: "vrm-field-group" });
        titleGroup.createEl("label", { text: "Video Title *" });
        const titleInput = titleGroup.createEl("input", {
            type: "text",
            cls: "vrm-input",
            placeholder: "e.g., Inception"
        });
        titleInput.setAttribute("id", "vrm-input-title");
        titleInput.setAttribute("autocomplete", "off");

        // Director Field
        const directorGroup = form.createDiv({ cls: "vrm-field-group" });
        directorGroup.createEl("label", { text: "Director / Creator" });
        const directorInput = directorGroup.createEl("input", {
            type: "text",
            cls: "vrm-input",
            placeholder: "e.g., Christopher Nolan"
        });
        directorInput.setAttribute("id", "vrm-input-director");
        directorInput.setAttribute("autocomplete", "off");

        // Genre and Subgenre Row
        const genreRow = form.createDiv({ cls: "vrm-row" });

        // Genre Field
        const genreGroup = genreRow.createDiv({ cls: "vrm-field-group" });
        genreGroup.createEl("label", { text: "Genre" });
        const genreInput = genreGroup.createEl("input", {
            type: "text",
            cls: "vrm-input",
            placeholder: "e.g., Sci-Fi, SF"
        });
        genreInput.setAttribute("id", "vrm-input-genre");
        genreInput.setAttribute("autocomplete", "off");

        // Subgenre Field
        const subgenreGroup = genreRow.createDiv({ cls: "vrm-field-group" });
        subgenreGroup.createEl("label", { text: "Subgenre" });
        const subgenreInput = subgenreGroup.createEl("input", {
            type: "text",
            cls: "vrm-input",
            placeholder: "e.g., Time Travel, Thriller"
        });
        subgenreInput.setAttribute("id", "vrm-input-subgenre");
        subgenreInput.setAttribute("autocomplete", "off");

        // Status Field
        const statusGroup = form.createDiv({ cls: "vrm-field-group" });
        statusGroup.createEl("label", { text: "Watching Status" });
        const statusSelect = statusGroup.createEl("select", { cls: "vrm-select" });
        statusSelect.createEl("option", { text: "To Watch (未視聴)", value: "To Watch" });
        statusSelect.createEl("option", { text: "Watching (視聴中)", value: "Watching" });
        statusSelect.createEl("option", { text: "Watched (視聴完了)", value: "Watched" });
        statusSelect.createEl("option", { text: "On Hold (保留中)", value: "On Hold" });

        // Rating Field
        const ratingGroup = form.createDiv({ cls: "vrm-field-group" });
        ratingGroup.createEl("label", { text: "Rating" });
        const ratingInputContainer = ratingGroup.createDiv({ cls: "vrm-rating-input" });
        let selectedRating = 0;
        const stars: HTMLSpanElement[] = [];
        for (let i = 1; i <= 5; i++) {
            const star = ratingInputContainer.createSpan({ text: "★", cls: "vrm-star" });
            star.addEventListener("click", () => {
                if (selectedRating === i) {
                    selectedRating = 0; // Toggle off if clicked again
                } else {
                    selectedRating = i;
                }
                updateStarsDisplay();
            });
            stars.push(star);
        }
        const updateStarsDisplay = () => {
            stars.forEach((star, idx) => {
                if (idx < selectedRating) {
                    star.addClass("is-selected");
                } else {
                    star.removeClass("is-selected");
                }
            });
        };

        // Toggle elements based on type
        const handleTypeChange = () => {
            const val = typeSelect.value;
            if (val === "Movie") {
                seriesRow.style.display = "none";
                seriesInput.value = "";
                seasonInput.value = "";
                episodeInput.value = "";
                titleInput.placeholder = "e.g., Inception";
            } else {
                seriesRow.style.display = "flex";
                if (!seasonInput.value) seasonInput.value = "01";
                if (!episodeInput.value) episodeInput.value = "01";
                titleInput.placeholder = "e.g., Breaking Bad S01E01";
                updateAutoTitle();
            }
        };
        typeSelect.addEventListener("change", handleTypeChange);

        // Action Buttons
        const buttonsContainer = form.createDiv({ cls: "vrm-buttons" });

        const cancelButton = buttonsContainer.createEl("button", {
            text: "Cancel",
            cls: "vrm-btn vrm-btn-secondary",
            type: "button"
        });
        cancelButton.addEventListener("click", () => this.close());

        const submitButton = buttonsContainer.createEl("button", {
            text: "Create Entry",
            cls: "vrm-btn vrm-btn-primary",
            type: "submit"
        });

        // Auto-focus Title/Series
        setTimeout(() => {
            if (typeSelect.value === "Movie") {
                titleInput.focus();
            } else {
                seriesInput.focus();
            }
        }, 50);

        // Define Suggestor helper (same as reading-record-manager)
        const createSuggestor = (
            inputEl: HTMLInputElement,
            getItems: (query: string) => { primary: string; secondary?: string; data: any }[],
            onSelect: (item: any) => void
        ) => {
            const parent = inputEl.parentElement;
            if (!parent) return;

            let suggestEl: HTMLDivElement | null = null;
            let selectedIndex = -1;
            let currentItems: any[] = [];

            const closeSuggest = () => {
                if (suggestEl) {
                    suggestEl.remove();
                    suggestEl = null;
                }
                selectedIndex = -1;
            };

            const renderSuggest = (items: { primary: string; secondary?: string; data: any }[]) => {
                closeSuggest();
                if (items.length === 0) return;

                currentItems = items;
                suggestEl = document.createElement("div");
                suggestEl.className = "vrm-suggest-container";

                items.forEach((item, index) => {
                    const itemEl = suggestEl!.createDiv({ cls: "vrm-suggest-item" });
                    
                    const textContainer = itemEl.createDiv({ cls: "vrm-suggest-item-text" });
                    textContainer.createSpan({ cls: "vrm-suggest-item-main", text: item.primary });
                    if (item.secondary) {
                        textContainer.createSpan({ cls: "vrm-suggest-item-sub", text: item.secondary });
                    }

                    itemEl.addEventListener("click", (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onSelect(item.data);
                        closeSuggest();
                    });

                    itemEl.addEventListener("mouseenter", () => {
                        updateSelection(index);
                    });
                });

                parent.appendChild(suggestEl);
            };

            const updateSelection = (index: number) => {
                if (!suggestEl) return;
                const items = suggestEl.querySelectorAll(".vrm-suggest-item");
                items.forEach((el, i) => {
                    if (i === index) {
                        el.addClass("is-selected");
                    } else {
                        el.removeClass("is-selected");
                    }
                });
                selectedIndex = index;

                const activeEl = items[index] as HTMLElement;
                if (activeEl) {
                    activeEl.scrollIntoView({ block: "nearest" });
                }
            };

            inputEl.addEventListener("input", () => {
                const query = inputEl.value.trim();
                const filtered = getItems(query);
                renderSuggest(filtered);
            });

            inputEl.addEventListener("focus", () => {
                const query = inputEl.value.trim();
                const filtered = getItems(query);
                renderSuggest(filtered);
            });

            inputEl.addEventListener("blur", () => {
                setTimeout(() => {
                    closeSuggest();
                }, 180);
            });

            inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
                if (e.isComposing) return;
                if (!suggestEl) return;

                if (e.key === "ArrowDown") {
                    e.preventDefault();
                    const nextIndex = (selectedIndex + 1) % currentItems.length;
                    updateSelection(nextIndex);
                } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    const prevIndex = (selectedIndex - 1 + currentItems.length) % currentItems.length;
                    updateSelection(prevIndex);
                } else if (e.key === "Enter" && selectedIndex >= 0) {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelect(currentItems[selectedIndex].data);
                    closeSuggest();
                } else if (e.key === "Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    closeSuggest();
                }
            });
        };

        // Helper to increment volume/episode strings cleanly
        const getNextEpisodeNum = (currentEpStr: string): string => {
            if (!currentEpStr) return "01";
            const numRegex = /(\d+)(?!.*\d)/;
            const match = currentEpStr.match(numRegex);
            if (match) {
                const numStr = match[1];
                const num = parseInt(numStr, 10);
                const nextNum = num + 1;
                let nextNumStr = String(nextNum);
                if (numStr.startsWith("0") && numStr.length > nextNumStr.length) {
                    nextNumStr = nextNumStr.padStart(numStr.length, "0");
                }
                return currentEpStr.replace(numRegex, nextNumStr);
            }
            return currentEpStr + " 2";
        };

        // Helper to update Title automatically based on Series, Season & Episode
        let userHasModifiedTitle = false;
        titleInput.addEventListener("input", () => {
            userHasModifiedTitle = (titleInput.value.trim() !== "");
        });

        const updateAutoTitle = () => {
            if (userHasModifiedTitle) return;
            if (typeSelect.value === "Movie") return;

            const seriesVal = seriesInput.value.trim();
            const seasonVal = seasonInput.value.trim();
            const episodeVal = episodeInput.value.trim();

            if (seriesVal) {
                let suffix = "";
                if (seasonVal || episodeVal) {
                    const s = seasonVal ? `S${sanitizeNumberStr(seasonVal)}` : "";
                    const e = episodeVal ? `E${sanitizeNumberStr(episodeVal)}` : "";
                    suffix = ` ${s}${e}`.trim();
                }
                titleInput.value = `${seriesVal} ${suffix}`.trim();
            }
        };

        seriesInput.addEventListener("input", updateAutoTitle);
        seasonInput.addEventListener("input", updateAutoTitle);
        episodeInput.addEventListener("input", updateAutoTitle);

        // Initialize Title suggestor for quick formatting selection
        createSuggestor(
            titleInput,
            (query: string) => {
                const matches: any[] = [];
                const seriesVal = seriesInput.value.trim();
                const seasonVal = seasonInput.value.trim();
                const episodeVal = episodeInput.value.trim();

                if (seriesVal && typeSelect.value !== "Movie") {
                    const variants: string[] = [];
                    const s = seasonVal ? `S${sanitizeNumberStr(seasonVal)}` : "";
                    const e = episodeVal ? `E${sanitizeNumberStr(episodeVal)}` : "";

                    if (s || e) {
                        variants.push(`${seriesVal} ${s}${e}`.trim());
                        variants.push(`${seriesVal} Season ${seasonVal} Episode ${episodeVal}`.trim());
                        variants.push(`${seriesVal} 第${seasonVal}シーズン 第${episodeVal}話`.trim());
                    } else {
                        variants.push(seriesVal);
                    }

                    variants.forEach(variant => {
                        if (!query || variant.toLowerCase().includes(query.toLowerCase())) {
                            matches.push({
                                primary: variant,
                                secondary: "✨ Generated from Series Info",
                                data: variant
                            });
                        }
                    });
                }
                return matches.slice(0, 5);
            },
            (title: string) => {
                titleInput.value = title;
                userHasModifiedTitle = true;
            }
        );

        // Initialize Series suggestor
        createSuggestor(
            seriesInput,
            (query: string) => {
                const q = query.toLowerCase();
                const matches: any[] = [];
                this.uniqueSeries.forEach((info, name) => {
                    if (!q || name.toLowerCase().includes(q)) {
                        let secondary = `Type: ${info.type}`;
                        if (info.director) secondary += ` | By: ${info.director}`;
                        if (info.maxSeasonStr) {
                            secondary += ` | Last: S${sanitizeNumberStr(info.maxSeasonStr)}E${sanitizeNumberStr(info.maxEpisodeStr)}`;
                        }
                        matches.push({
                            primary: name,
                            secondary: secondary,
                            data: { name, ...info }
                        });
                    }
                });
                return matches.slice(0, 8);
            },
            (data: any) => {
                seriesInput.value = data.name;
                typeSelect.value = data.type;
                handleTypeChange();

                if (data.director && !directorInput.value.trim()) {
                    directorInput.value = data.director;
                }
                if (data.genre && !genreInput.value.trim()) {
                    genreInput.value = data.genre;
                }
                if (data.subgenre && !subgenreInput.value.trim()) {
                    subgenreInput.value = data.subgenre;
                }
                
                if (data.maxSeasonStr) {
                    seasonInput.value = sanitizeNumberStr(data.maxSeasonStr);
                    episodeInput.value = getNextEpisodeNum(data.maxEpisodeStr);
                } else {
                    seasonInput.value = "01";
                    episodeInput.value = "01";
                }

                // Auto-update Title based on selection
                updateAutoTitle();

                // Focus episode field and highlight for quick overwrite
                setTimeout(() => {
                    episodeInput.focus();
                    episodeInput.select();
                }, 50);
            }
        );

        // Initialize Director suggestor
        createSuggestor(
            directorInput,
            (query: string) => {
                const q = query.toLowerCase();
                const matches: any[] = [];
                this.uniqueDirectors.forEach((dir) => {
                    if (!q || dir.toLowerCase().includes(q)) {
                        matches.push({
                            primary: dir,
                            data: dir
                        });
                    }
                });
                return matches.slice(0, 8);
            },
            (dir: string) => {
                directorInput.value = dir;
            }
        );

        // Initialize Genre suggestor
        createSuggestor(
            genreInput,
            (query: string) => {
                const q = query.toLowerCase();
                const matches: any[] = [];
                this.uniqueGenres.forEach((g) => {
                    if (!q || g.toLowerCase().includes(q)) {
                        matches.push({
                            primary: g,
                            data: g
                        });
                    }
                });
                return matches.slice(0, 8);
            },
            (g: string) => {
                genreInput.value = g;
                setTimeout(() => {
                    subgenreInput.focus();
                }, 50);
            }
        );

        // Initialize Subgenre suggestor
        createSuggestor(
            subgenreInput,
            (query: string) => {
                const q = query.toLowerCase();
                const matches: any[] = [];
                this.uniqueSubgenres.forEach((sub) => {
                    if (!q || sub.toLowerCase().includes(q)) {
                        matches.push({
                            primary: sub,
                            data: sub
                        });
                    }
                });
                return matches.slice(0, 8);
            },
            (sub: string) => {
                subgenreInput.value = sub;
            }
        );

        // Submit action
        const submitAction = () => {
            const typeVal = typeSelect.value as "Movie" | "Drama" | "Anime";
            const titleVal = titleInput.value.trim();
            const seriesVal = seriesInput.value.trim();
            const seasonVal = seasonInput.value.trim();
            const episodeVal = episodeInput.value.trim();
            const directorVal = directorInput.value.trim();
            const genreVal = genreInput.value.trim();
            const subgenreVal = subgenreInput.value.trim();
            const statusVal = statusSelect.value;

            if (typeVal !== "Movie" && !seriesVal) {
                new Notice("Error: Series Name is a required field for Drama and Anime.");
                seriesInput.focus();
                return;
            }
            if (!titleVal) {
                new Notice("Error: Video Title is a required field.");
                titleInput.focus();
                return;
            }

            this.close();
            this.onSubmit({
                type: typeVal,
                title: titleVal,
                seriesName: seriesVal,
                season: typeVal !== "Movie" ? sanitizeNumberStr(seasonVal) : "",
                episode: typeVal !== "Movie" ? sanitizeNumberStr(episodeVal) : "",
                director: directorVal,
                genre: genreVal,
                subgenre: subgenreVal,
                status: statusVal,
                rating: selectedRating
            });
        };

        submitButton.addEventListener("click", (e) => {
            e.preventDefault();
            submitAction();
        });

        // Handle Enter key for rapid entry
        const handleEnter = (e: KeyboardEvent) => {
            if (e.isComposing) return;
            if (e.key === "Enter") {
                e.preventDefault();
                submitAction();
            }
        };
        titleInput.addEventListener("keydown", handleEnter);
        seriesInput.addEventListener("keydown", handleEnter);
        seasonInput.addEventListener("keydown", handleEnter);
        episodeInput.addEventListener("keydown", handleEnter);
        directorInput.addEventListener("keydown", handleEnter);
        genreInput.addEventListener("keydown", handleEnter);
        subgenreInput.addEventListener("keydown", handleEnter);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// Custom Edit Video Modal Class
class EditVideoModal extends Modal {
    initialData: {
        title: string;
        type: "Movie" | "Drama" | "Anime";
        director: string;
        seriesName: string;
        season: string;
        episode: string;
        genre: string;
        subgenre: string;
        status: string;
        rating: number;
    };
    onSubmit: (result: {
        title: string;
        type: "Movie" | "Drama" | "Anime";
        director: string;
        seriesName: string;
        season: string;
        episode: string;
        genre: string;
        subgenre: string;
        status: string;
        rating: number;
    }) => void;

    // Data structures for auto-suggest
    uniqueSeries: Map<string, { director: string; genre: string; subgenre: string; type: "Movie" | "Drama" | "Anime"; maxSeasonNum: number; maxEpisodeNum: number; maxSeasonStr: string; maxEpisodeStr: string }> = new Map();
    uniqueDirectors: Set<string> = new Set();
    uniqueGenres: Set<string> = new Set();
    uniqueSubgenres: Set<string> = new Set();

    constructor(app: App, initialData: any, onSubmit: (result: any) => void) {
        super(app);
        this.initialData = initialData;
        this.onSubmit = onSubmit;
        this.scanExistingVideos();
    }

    scanExistingVideos() {
        const files = this.app.vault.getMarkdownFiles();
        for (const file of files) {
            const cache = this.app.metadataCache.getFileCache(file);
            const frontmatter = cache?.frontmatter;
            if (!frontmatter) continue;

            const isInVideosFolder = file.path.startsWith("Videos/");

            if (isInVideosFolder) {
                const director = frontmatter.director || "";
                const series = frontmatter.series || "";
                const season = frontmatter.season || "";
                const episode = frontmatter.episode || "";
                const genre = frontmatter.genre || "";
                const subgenre = frontmatter.subgenre || "";
                const type = frontmatter.type || "Movie";

                if (director && director.trim()) {
                    this.uniqueDirectors.add(director.trim());
                }

                if (genre && genre.trim()) {
                    this.uniqueGenres.add(genre.trim());
                }

                if (subgenre && subgenre.trim()) {
                    this.uniqueSubgenres.add(subgenre.trim());
                }

                if (series && series.trim()) {
                    const seriesKey = series.trim();
                    const cleanDirector = director ? director.trim() : "";
                    const cleanGenre = genre ? genre.trim() : "";
                    const cleanSubgenre = subgenre ? subgenre.trim() : "";

                    const seasonDigits = String(season).replace(/\D/g, "");
                    const seasonNum = seasonDigits ? parseInt(seasonDigits, 10) : NaN;

                    const epDigits = String(episode).replace(/\D/g, "");
                    const epNum = epDigits ? parseInt(epDigits, 10) : NaN;

                    const existing = this.uniqueSeries.get(seriesKey);
                    if (existing) {
                        let isNewer = false;
                        if (!isNaN(seasonNum)) {
                            if (isNaN(existing.maxSeasonNum) || seasonNum > existing.maxSeasonNum) {
                                isNewer = true;
                            } else if (seasonNum === existing.maxSeasonNum && !isNaN(epNum)) {
                                if (isNaN(existing.maxEpisodeNum) || epNum > existing.maxEpisodeNum) {
                                    isNewer = true;
                                }
                            }
                        }

                        if (isNewer) {
                            existing.maxSeasonNum = isNaN(seasonNum) ? -1 : seasonNum;
                            existing.maxEpisodeNum = isNaN(epNum) ? -1 : epNum;
                            existing.maxSeasonStr = String(season);
                            existing.maxEpisodeStr = String(episode);
                        }

                        if (!existing.director && cleanDirector) existing.director = cleanDirector;
                        if (!existing.genre && cleanGenre) existing.genre = cleanGenre;
                        if (!existing.subgenre && cleanSubgenre) existing.subgenre = cleanSubgenre;
                    } else {
                        this.uniqueSeries.set(seriesKey, {
                            director: cleanDirector,
                            genre: cleanGenre,
                            subgenre: cleanSubgenre,
                            type: type,
                            maxSeasonNum: isNaN(seasonNum) ? -1 : seasonNum,
                            maxEpisodeNum: isNaN(epNum) ? -1 : epNum,
                            maxSeasonStr: String(season),
                            maxEpisodeStr: String(episode)
                        });
                    }
                }
            }
        }
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.addClass("vrm-modal");

        // Modal Title
        contentEl.createEl("h2", { text: "✍️ Edit Video Properties", cls: "vrm-modal-title" });

        // Form Container
        const form = contentEl.createDiv({ cls: "vrm-form" });

        // Content Type Row
        const typeGroup = form.createDiv({ cls: "vrm-field-group" });
        typeGroup.createEl("label", { text: "Content Type" });
        const typeSelect = typeGroup.createEl("select", { cls: "vrm-select" });
        typeSelect.createEl("option", { text: "Movie (映画)", value: "Movie" });
        typeSelect.createEl("option", { text: "Drama (ドラマ)", value: "Drama" });
        typeSelect.createEl("option", { text: "Anime (アニメ)", value: "Anime" });
        typeSelect.value = this.initialData.type || "Movie";

        // Series and Episode Side-by-Side row
        const seriesRow = form.createDiv({ cls: "vrm-row" });

        // Series Field
        const seriesGroup = seriesRow.createDiv({ cls: "vrm-field-group" });
        seriesGroup.createEl("label", { text: "Series / Show Title (Optional)" });
        const seriesInput = seriesGroup.createEl("input", {
            type: "text",
            cls: "vrm-input",
            placeholder: "e.g., Breaking Bad"
        });
        seriesInput.setAttribute("id", "vrm-input-series");
        seriesInput.setAttribute("autocomplete", "off");
        seriesInput.value = this.initialData.seriesName || "";

        // Season Field
        const seasonGroup = seriesRow.createDiv({ cls: "vrm-field-group", attr: { style: "max-width: 80px;" } });
        seasonGroup.createEl("label", { text: "Season" });
        const seasonInput = seasonGroup.createEl("input", {
            type: "text",
            cls: "vrm-input",
            placeholder: "e.g., 01"
        });
        seasonInput.setAttribute("id", "vrm-input-season");
        seasonInput.setAttribute("autocomplete", "off");
        seasonInput.value = this.initialData.season || "";

        // Episode Field
        const episodeGroup = seriesRow.createDiv({ cls: "vrm-field-group", attr: { style: "max-width: 80px;" } });
        episodeGroup.createEl("label", { text: "Episode" });
        const episodeInput = episodeGroup.createEl("input", {
            type: "text",
            cls: "vrm-input",
            placeholder: "e.g., 01"
        });
        episodeInput.setAttribute("id", "vrm-input-episode");
        episodeInput.setAttribute("autocomplete", "off");
        episodeInput.value = this.initialData.episode || "";

        // Video Title Field
        const titleGroup = form.createDiv({ cls: "vrm-field-group" });
        titleGroup.createEl("label", { text: "Video Title *" });
        const titleInput = titleGroup.createEl("input", {
            type: "text",
            cls: "vrm-input",
            placeholder: "e.g., Inception"
        });
        titleInput.setAttribute("id", "vrm-input-title");
        titleInput.setAttribute("autocomplete", "off");
        titleInput.value = this.initialData.title || "";

        // Director Field
        const directorGroup = form.createDiv({ cls: "vrm-field-group" });
        directorGroup.createEl("label", { text: "Director / Creator" });
        const directorInput = directorGroup.createEl("input", {
            type: "text",
            cls: "vrm-input",
            placeholder: "e.g., Christopher Nolan"
        });
        directorInput.setAttribute("id", "vrm-input-director");
        directorInput.setAttribute("autocomplete", "off");
        directorInput.value = this.initialData.director || "";

        // Genre and Subgenre Row
        const genreRow = form.createDiv({ cls: "vrm-row" });

        // Genre Field
        const genreGroup = genreRow.createDiv({ cls: "vrm-field-group" });
        genreGroup.createEl("label", { text: "Genre" });
        const genreInput = genreGroup.createEl("input", {
            type: "text",
            cls: "vrm-input",
            placeholder: "e.g., Sci-Fi"
        });
        genreInput.setAttribute("id", "vrm-input-genre");
        genreInput.setAttribute("autocomplete", "off");
        genreInput.value = this.initialData.genre || "";

        // Subgenre Field
        const subgenreGroup = genreRow.createDiv({ cls: "vrm-field-group" });
        subgenreGroup.createEl("label", { text: "Subgenre" });
        const subgenreInput = subgenreGroup.createEl("input", {
            type: "text",
            cls: "vrm-input",
            placeholder: "e.g., Time Travel"
        });
        subgenreInput.setAttribute("id", "vrm-input-subgenre");
        subgenreInput.setAttribute("autocomplete", "off");
        subgenreInput.value = this.initialData.subgenre || "";

        // Status Field
        const statusGroup = form.createDiv({ cls: "vrm-field-group" });
        statusGroup.createEl("label", { text: "Watching Status" });
        const statusSelect = statusGroup.createEl("select", { cls: "vrm-select" });
        statusSelect.createEl("option", { text: "To Watch (未視聴)", value: "To Watch" });
        statusSelect.createEl("option", { text: "Watching (視聴中)", value: "Watching" });
        statusSelect.createEl("option", { text: "Watched (視聴完了)", value: "Watched" });
        statusSelect.createEl("option", { text: "On Hold (保留中)", value: "On Hold" });
        statusSelect.value = this.initialData.status || "To Watch";

        // Rating Field
        const ratingGroup = form.createDiv({ cls: "vrm-field-group" });
        ratingGroup.createEl("label", { text: "Rating" });
        const ratingInputContainer = ratingGroup.createDiv({ cls: "vrm-rating-input" });
        let selectedRating = this.initialData.rating || 0;
        const stars: HTMLSpanElement[] = [];
        for (let i = 1; i <= 5; i++) {
            const star = ratingInputContainer.createSpan({ text: "★", cls: "vrm-star" });
            star.addEventListener("click", () => {
                if (selectedRating === i) {
                    selectedRating = 0; // Toggle off if clicked again
                } else {
                    selectedRating = i;
                }
                updateStarsDisplay();
            });
            stars.push(star);
        }
        const updateStarsDisplay = () => {
            stars.forEach((star, idx) => {
                if (idx < selectedRating) {
                    star.addClass("is-selected");
                } else {
                    star.removeClass("is-selected");
                }
            });
        };
        updateStarsDisplay(); // Pre-fill with initial rating value

        // Setup visibility initial and event listener
        const handleTypeChange = () => {
            const val = typeSelect.value;
            if (val === "Movie") {
                seriesRow.style.display = "none";
            } else {
                seriesRow.style.display = "flex";
            }
        };
        typeSelect.addEventListener("change", handleTypeChange);
        handleTypeChange(); // Call initial

        // Action Buttons
        const buttonsContainer = form.createDiv({ cls: "vrm-buttons" });

        const cancelButton = buttonsContainer.createEl("button", {
            text: "Cancel",
            cls: "vrm-btn vrm-btn-secondary",
            type: "button"
        });
        cancelButton.addEventListener("click", () => this.close());

        const submitButton = buttonsContainer.createEl("button", {
            text: "Save Changes",
            cls: "vrm-btn vrm-btn-primary",
            type: "submit"
        });

        // Autocomplete setup helper (re-used)
        const createSuggestor = (
            inputEl: HTMLInputElement,
            getItems: (query: string) => { primary: string; secondary?: string; data: any }[],
            onSelect: (item: any) => void
        ) => {
            const parent = inputEl.parentElement;
            if (!parent) return;

            let suggestEl: HTMLDivElement | null = null;
            let selectedIndex = -1;
            let currentItems: any[] = [];

            const closeSuggest = () => {
                if (suggestEl) {
                    suggestEl.remove();
                    suggestEl = null;
                }
                selectedIndex = -1;
            };

            const renderSuggest = (items: { primary: string; secondary?: string; data: any }[]) => {
                closeSuggest();
                if (items.length === 0) return;

                currentItems = items;
                suggestEl = document.createElement("div");
                suggestEl.className = "vrm-suggest-container";

                items.forEach((item, index) => {
                    const itemEl = suggestEl!.createDiv({ cls: "vrm-suggest-item" });
                    const textContainer = itemEl.createDiv({ cls: "vrm-suggest-item-text" });
                    textContainer.createSpan({ cls: "vrm-suggest-item-main", text: item.primary });
                    if (item.secondary) {
                        textContainer.createSpan({ cls: "vrm-suggest-item-sub", text: item.secondary });
                    }

                    itemEl.addEventListener("click", (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onSelect(item.data);
                        closeSuggest();
                    });

                    itemEl.addEventListener("mouseenter", () => {
                        updateSelection(index);
                    });
                });

                parent.appendChild(suggestEl);
            };

            const updateSelection = (index: number) => {
                if (!suggestEl) return;
                const items = suggestEl.querySelectorAll(".vrm-suggest-item");
                items.forEach((el, i) => {
                    if (i === index) el.addClass("is-selected");
                    else el.removeClass("is-selected");
                });
                selectedIndex = index;

                const activeEl = items[index] as HTMLElement;
                if (activeEl) activeEl.scrollIntoView({ block: "nearest" });
            };

            inputEl.addEventListener("input", () => {
                const query = inputEl.value.trim();
                const filtered = getItems(query);
                renderSuggest(filtered);
            });

            inputEl.addEventListener("focus", () => {
                const query = inputEl.value.trim();
                const filtered = getItems(query);
                renderSuggest(filtered);
            });

            inputEl.addEventListener("blur", () => {
                setTimeout(() => closeSuggest(), 180);
            });

            inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
                if (e.isComposing) return;
                if (!suggestEl) return;

                if (e.key === "ArrowDown") {
                    e.preventDefault();
                    const nextIndex = (selectedIndex + 1) % currentItems.length;
                    updateSelection(nextIndex);
                } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    const prevIndex = (selectedIndex - 1 + currentItems.length) % currentItems.length;
                    updateSelection(prevIndex);
                } else if (e.key === "Enter" && selectedIndex >= 0) {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelect(currentItems[selectedIndex].data);
                    closeSuggest();
                } else if (e.key === "Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    closeSuggest();
                }
            });
        };

        // Initialize Series suggestor
        createSuggestor(
            seriesInput,
            (query: string) => {
                const q = query.toLowerCase();
                const matches: any[] = [];
                this.uniqueSeries.forEach((info, name) => {
                    if (!q || name.toLowerCase().includes(q)) {
                        let secondary = `Type: ${info.type}`;
                        if (info.director) secondary += ` | By: ${info.director}`;
                        matches.push({
                            primary: name,
                            secondary: secondary,
                            data: { name, ...info }
                        });
                    }
                });
                return matches.slice(0, 8);
            },
            (data: any) => {
                seriesInput.value = data.name;
                typeSelect.value = data.type;
                handleTypeChange();

                if (data.director && !directorInput.value.trim()) {
                    directorInput.value = data.director;
                }
                if (data.genre && !genreInput.value.trim()) {
                    genreInput.value = data.genre;
                }
                if (data.subgenre && !subgenreInput.value.trim()) {
                    subgenreInput.value = data.subgenre;
                }
            }
        );

        // Initialize Director suggestor
        createSuggestor(
            directorInput,
            (query: string) => {
                const q = query.toLowerCase();
                const matches: any[] = [];
                this.uniqueDirectors.forEach((dir) => {
                    if (!q || dir.toLowerCase().includes(q)) {
                        matches.push({ primary: dir, data: dir });
                    }
                });
                return matches.slice(0, 8);
            },
            (dir: string) => { directorInput.value = dir; }
        );

        // Initialize Genre suggestor
        createSuggestor(
            genreInput,
            (query: string) => {
                const q = query.toLowerCase();
                const matches: any[] = [];
                this.uniqueGenres.forEach((g) => {
                    if (!q || g.toLowerCase().includes(q)) {
                        matches.push({ primary: g, data: g });
                    }
                });
                return matches.slice(0, 8);
            },
            (g: string) => {
                genreInput.value = g;
                setTimeout(() => subgenreInput.focus(), 50);
            }
        );

        // Initialize Subgenre suggestor
        createSuggestor(
            subgenreInput,
            (query: string) => {
                const q = query.toLowerCase();
                const matches: any[] = [];
                this.uniqueSubgenres.forEach((sub) => {
                    if (!q || sub.toLowerCase().includes(q)) {
                        matches.push({ primary: sub, data: sub });
                    }
                });
                return matches.slice(0, 8);
            },
            (sub: string) => { subgenreInput.value = sub; }
        );

        const submitAction = () => {
            const typeVal = typeSelect.value as "Movie" | "Drama" | "Anime";
            const titleVal = titleInput.value.trim();
            const seriesVal = seriesInput.value.trim();
            const seasonVal = seriesVal ? sanitizeNumberStr(seasonInput.value.trim()) : "";
            const episodeVal = seriesVal ? sanitizeNumberStr(episodeInput.value.trim()) : "";
            const directorVal = directorInput.value.trim();
            const genreVal = genreInput.value.trim();
            const subgenreVal = subgenreInput.value.trim();
            const statusVal = statusSelect.value;

            if (typeVal !== "Movie" && !seriesVal) {
                new Notice("Error: Series Name is required for Drama and Anime.");
                seriesInput.focus();
                return;
            }
            if (!titleVal) {
                new Notice("Error: Video Title is required.");
                titleInput.focus();
                return;
            }

            this.close();
            this.onSubmit({
                type: typeVal,
                title: titleVal,
                seriesName: seriesVal,
                season: seasonVal,
                episode: episodeVal,
                director: directorVal,
                genre: genreVal,
                subgenre: subgenreVal,
                status: statusVal,
                rating: selectedRating
            });
        };

        submitButton.addEventListener("click", (e) => {
            e.preventDefault();
            submitAction();
        });

        const handleEnter = (e: KeyboardEvent) => {
            if (e.isComposing) return;
            if (e.key === "Enter") {
                e.preventDefault();
                submitAction();
            }
        };
        titleInput.addEventListener("keydown", handleEnter);
        seriesInput.addEventListener("keydown", handleEnter);
        seasonInput.addEventListener("keydown", handleEnter);
        episodeInput.addEventListener("keydown", handleEnter);
        directorInput.addEventListener("keydown", handleEnter);
        genreInput.addEventListener("keydown", handleEnter);
        subgenreInput.addEventListener("keydown", handleEnter);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// Modal to change status and rating of a video
class StatusRatingModal extends Modal {
    file: TFile;
    initialStatus: string;
    initialRating: number;
    onSubmit: (status: string, rating: number) => void;

    constructor(app: App, file: TFile, initialStatus: string, initialRating: number, onSubmit: (status: string, rating: number) => void) {
        super(app);
        this.file = file;
        this.initialStatus = initialStatus;
        this.initialRating = initialRating;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.addClass("vrm-modal");

        contentEl.createEl("h2", { text: `Update Status & Rating`, cls: "vrm-modal-title" });
        contentEl.createEl("p", { text: this.file.basename, cls: "vrm-modal-subtitle" });

        const form = contentEl.createDiv({ cls: "vrm-form" });

        // Status Field
        const statusGroup = form.createDiv({ cls: "vrm-field-group" });
        statusGroup.createEl("label", { text: "Watching Status" });
        const statusSelect = statusGroup.createEl("select", { cls: "vrm-select" });
        const statuses = ["To Watch", "Watching", "Watched", "On Hold"];
        statuses.forEach(status => {
            const option = statusSelect.createEl("option", { text: status, value: status });
            if (status === this.initialStatus) {
                option.selected = true;
            }
        });

        // Rating Field
        const ratingGroup = form.createDiv({ cls: "vrm-field-group" });
        ratingGroup.createEl("label", { text: "Rating" });
        const ratingInputContainer = ratingGroup.createDiv({ cls: "vrm-rating-input" });
        let selectedRating = this.initialRating;
        const stars: HTMLSpanElement[] = [];
        for (let i = 1; i <= 5; i++) {
            const star = ratingInputContainer.createSpan({ text: "★", cls: "vrm-star" });
            star.addEventListener("click", () => {
                if (selectedRating === i) {
                    selectedRating = 0; // Toggle off if clicked again
                } else {
                    selectedRating = i;
                }
                updateStarsDisplay();
            });
            stars.push(star);
        }
        const updateStarsDisplay = () => {
            stars.forEach((star, idx) => {
                if (idx < selectedRating) {
                    star.addClass("is-selected");
                } else {
                    star.removeClass("is-selected");
                }
            });
        };
        updateStarsDisplay();

        // Action Buttons
        const buttonsContainer = form.createDiv({ cls: "vrm-buttons" });

        const cancelButton = buttonsContainer.createEl("button", {
            text: "Cancel",
            cls: "vrm-btn vrm-btn-secondary",
            type: "button"
        });
        cancelButton.addEventListener("click", () => this.close());

        const submitButton = buttonsContainer.createEl("button", {
            text: "Update",
            cls: "vrm-btn vrm-btn-primary",
            type: "submit"
        });

        submitButton.addEventListener("click", (e) => {
            e.preventDefault();
            this.close();
            this.onSubmit(statusSelect.value, selectedRating);
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 2x2 Grid Control Panel Class
class QuickActionModal extends Modal {
    plugin: VideoRecordManager;

    constructor(app: App, plugin: VideoRecordManager) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.addClass("vrm-modal");

        // Modal Title
        contentEl.createEl("h2", { text: "🎥 Video Record Control Panel", cls: "vrm-modal-title" });

        // 2x2 Grid Container
        const grid = contentEl.createDiv({ cls: "vrm-quick-menu-grid" });

        // 1. Add Video Entry
        const addCard = grid.createDiv({ cls: "vrm-quick-menu-card" });
        addCard.createDiv({ cls: "vrm-quick-menu-icon", text: "➕" });
        addCard.createDiv({ cls: "vrm-quick-menu-title", text: "Add Video Entry" });
        addCard.createDiv({ cls: "vrm-quick-menu-desc", text: "Create a movie or TV show episode log" });
        addCard.addEventListener("click", () => {
            this.close();
            this.plugin.openAddVideoModal();
        });

        // 2. Edit Current Properties
        const editCard = grid.createDiv({ cls: "vrm-quick-menu-card" });
        editCard.createDiv({ cls: "vrm-quick-menu-icon", text: "✍️" });
        editCard.createDiv({ cls: "vrm-quick-menu-title", text: "Edit Properties" });
        editCard.createDiv({ cls: "vrm-quick-menu-desc", text: "Modify metadata of the current video file" });
        editCard.addEventListener("click", () => {
            this.close();
            this.plugin.openEditVideoModalOfCurrentFile();
        });

        // 3. Change Status/Rating
        const toggleCard = grid.createDiv({ cls: "vrm-quick-menu-card" });
        toggleCard.createDiv({ cls: "vrm-quick-menu-icon", text: "🔄" });
        toggleCard.createDiv({ cls: "vrm-quick-menu-title", text: "Change Status/Rating" });
        toggleCard.createDiv({ cls: "vrm-quick-menu-desc", text: "Update watching status and star rating" });
        toggleCard.addEventListener("click", async () => {
            this.close();
            await this.plugin.toggleCurrentVideoStatus();
        });

        // 4. Open Tracker Sidebar
        const sidebarCard = grid.createDiv({ cls: "vrm-quick-menu-card" });
        sidebarCard.createDiv({ cls: "vrm-quick-menu-icon", text: "📊" });
        sidebarCard.createDiv({ cls: "vrm-quick-menu-title", text: "Open Sidebar View" });
        sidebarCard.createDiv({ cls: "vrm-quick-menu-desc", text: "Show visual watching statistics and quick tools" });
        sidebarCard.addEventListener("click", () => {
            this.close();
            this.plugin.activateSidebarView();
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// Sidebar Custom View Class
const SIDEBAR_VIEW_TYPE = "video-watching-status-sidebar";

class VideoStatusSidebarView extends ItemView {
    plugin: VideoRecordManager;
    activeType: string = "All";
    activeMode: "tracker" | "retrospective" = "tracker";

    constructor(leaf: WorkspaceLeaf, plugin: VideoRecordManager) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return SIDEBAR_VIEW_TYPE;
    }

    getDisplayText(): string {
        return "Video Tracker";
    }

    getIcon(): string {
        return "video";
    }

    async onOpen() {
        this.render();
        // Subscribe to metadata events for real-time sidebar re-renders
        this.registerEvent(this.app.metadataCache.on("changed", () => this.render()));
        this.registerEvent(this.app.vault.on("create", () => this.render()));
        this.registerEvent(this.app.vault.on("delete", () => this.render()));
    }

    async render() {
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass("vrm-sidebar-container");

        // Header Title
        const header = container.createDiv({ cls: "vrm-sidebar-header" });
        const titleEl = header.createEl("h3", { text: "🎬 Video Tracker" });

        // Calculate Stats
        const files = this.app.vault.getMarkdownFiles();
        
        interface VideoItem {
            file: TFile;
            title: string;
            series: string;
            season: string;
            episode: string;
            director: string;
            type: "Movie" | "Drama" | "Anime";
            status: string;
            rating: number;
            genre: string;
            subgenre: string;
            endDate: string;
            updated: string;
        }

        const videos: VideoItem[] = [];

        for (const file of files) {
            // Skip dashboard
            if (file.path === "Videos/Master Video List.md") continue;

            const cache = this.app.metadataCache.getFileCache(file);
            const frontmatter = cache?.frontmatter;
            if (!frontmatter) continue;

            const isInVideosFolder = file.path.startsWith("Videos/");

            if (isInVideosFolder) {
                const status = frontmatter.status || "To Watch";
                const type = frontmatter.type || "Movie";
                videos.push({
                    file: file,
                    title: frontmatter.title || file.basename,
                    series: frontmatter.series || "",
                    season: frontmatter.season || "",
                    episode: frontmatter.episode || "",
                    director: frontmatter.director || "",
                    type: type as "Movie" | "Drama" | "Anime",
                    status: status,
                    rating: frontmatter.rating || 0,
                    genre: frontmatter.genre || "",
                    subgenre: frontmatter.subgenre || "",
                    endDate: frontmatter.end_date || "",
                    updated: frontmatter.updated || ""
                });
            }
        }

        titleEl.setText(`🎬 Video Tracker (${videos.length})`);

        // Mode switch buttons
        const modeSelector = container.createDiv({ cls: "vrm-sidebar-mode-selector" });
        const trackerBtn = modeSelector.createEl("button", { 
            text: "📝 Tracker", 
            cls: `vrm-sidebar-mode-btn ${this.activeMode === "tracker" ? "is-active" : ""}` 
        });
        trackerBtn.addEventListener("click", () => {
            this.activeMode = "tracker";
            this.render();
        });
        const retroBtn = modeSelector.createEl("button", { 
            text: "✨ Retro", 
            cls: `vrm-sidebar-mode-btn ${this.activeMode === "retrospective" ? "is-active" : ""}` 
        });
        retroBtn.addEventListener("click", () => {
            this.activeMode = "retrospective";
            this.render();
        });

        if (this.activeMode === "tracker") {
            // Type tabs bar
            const tabsContainer = container.createDiv({ cls: "vrm-sidebar-tabs" });
            const tabTypes = ["All", "Movie", "Drama", "Anime"];
            tabTypes.forEach(t => {
                const tab = tabsContainer.createEl("button", { text: t, cls: `vrm-sidebar-tab ${this.activeType === t ? "is-active" : ""}` });
                tab.addEventListener("click", () => {
                    this.activeType = t;
                    this.render();
                });
            });

            // Filter videos based on active category
            const filteredVideos = this.activeType === "All"
                ? videos
                : videos.filter(v => v.type === this.activeType);

            const toWatch = filteredVideos.filter(v => v.status === "To Watch").length;
            const watching = filteredVideos.filter(v => v.status === "Watching").length;
            const watched = filteredVideos.filter(v => v.status === "Watched").length;

            // Stats Row
            const statsRow = container.createDiv({ cls: "vrm-sidebar-stats" });

            const toWatchCard = statsRow.createDiv({ cls: "vrm-sidebar-stat-card" });
            toWatchCard.createDiv({ cls: "vrm-sidebar-stat-label", text: "To Watch" });
            toWatchCard.createDiv({ cls: "vrm-sidebar-stat-count", text: String(toWatch) });

            const watchingCard = statsRow.createDiv({ cls: "vrm-sidebar-stat-card" });
            watchingCard.createDiv({ cls: "vrm-sidebar-stat-label", text: "Watching" });
            watchingCard.createDiv({ cls: "vrm-sidebar-stat-count", text: String(watching) });

            const watchedCard = statsRow.createDiv({ cls: "vrm-sidebar-stat-card" });
            watchedCard.createDiv({ cls: "vrm-sidebar-stat-label", text: "Watched" });
            watchedCard.createDiv({ cls: "vrm-sidebar-stat-count", text: String(watched) });

            // Helper function to render sections (Watching, To Watch, Watched)
            const renderVideoList = (itemsList: VideoItem[], sectionTitle: string, emptyMsg: string) => {
                container.createEl("h4", { text: sectionTitle, cls: "vrm-sidebar-section-title" });
                if (itemsList.length === 0) {
                    container.createDiv({ cls: "vrm-sidebar-empty-text", text: emptyMsg });
                } else {
                    const list = container.createDiv({ cls: "vrm-sidebar-list" });
                    
                    // Sort by mtime descending
                    itemsList.sort((a, b) => b.file.stat.mtime - a.file.stat.mtime);

                    itemsList.forEach(item => {
                        const card = list.createDiv({ cls: "vrm-sidebar-item" });

                        const cardTop = card.createDiv({ cls: "vrm-sidebar-item-top" });
                        const infoContainer = cardTop.createDiv({ cls: "vrm-sidebar-item-info" });
                        
                        // Clickable Title to Open File
                        const titleLink = infoContainer.createEl("a", { 
                            cls: "vrm-sidebar-item-title", 
                            text: item.title 
                        });
                        titleLink.addEventListener("click", (e) => {
                            e.preventDefault();
                            this.app.workspace.getLeaf(false).openFile(item.file);
                        });

                        if (item.director) {
                            infoContainer.createDiv({ cls: "vrm-sidebar-item-director", text: `By: ${item.director}` });
                        }

                        // Show Rating
                        if (item.rating > 0) {
                            infoContainer.createDiv({ 
                                text: "★".repeat(item.rating), 
                                cls: "vrm-stars-display" 
                            });
                        }

                        // Show S/E or Movie metadata
                        const metaRow = infoContainer.createDiv({ cls: "vrm-sidebar-item-meta" });
                        
                        // Type Badge
                        const typeClass = `vrm-badge-${item.type.toLowerCase()}`;
                        metaRow.createSpan({ cls: `vrm-badge ${typeClass}`, text: item.type });

                        if (item.type !== "Movie" && (item.season || item.episode)) {
                            const sStr = item.season ? `S${sanitizeNumberStr(item.season)}` : "";
                            const eStr = item.episode ? `E${sanitizeNumberStr(item.episode)}` : "";
                            metaRow.createSpan({ 
                                cls: "vrm-badge vrm-badge-to-watch", 
                                text: `${sStr}${eStr}`.trim() 
                            });
                        }

                        // Action Row
                        const actionsRow = card.createDiv({ cls: "vrm-sidebar-item-actions" });

                        // Status/Rating Update Button
                        const watchedBtn = actionsRow.createEl("button", {
                            cls: "vrm-sidebar-item-btn vrm-sidebar-item-btn-primary",
                            text: "⚙ Update"
                        });
                        watchedBtn.addEventListener("click", async () => {
                            await this.plugin.toggleBookStatus(item.file);
                        });

                        // Next Episode +1 Shortcut Button (Drama & Anime only, if in Watching state)
                        if (item.status === "Watching" && item.type !== "Movie" && item.series) {
                            const nextEpBtn = actionsRow.createEl("button", {
                                cls: "vrm-sidebar-item-btn",
                                text: "⏭️ Next Ep"
                            });
                            nextEpBtn.title = "Mark as Watched and create next episode note automatically";
                            nextEpBtn.addEventListener("click", async () => {
                                await this.plugin.createAndOpenNextEpisode(item);
                            });
                        }
                    });
                }
            };

            // Render Directory Lists
            renderVideoList(filteredVideos.filter(v => v.status === "Watching"), "🍿 Currently Watching", "No active videos. Go grab some popcorn! 🍿");
            renderVideoList(filteredVideos.filter(v => v.status === "To Watch"), "⚪ To Watch", "No bookmarked videos.");
            
            const watchedVideosToRender = filteredVideos.filter(v => {
                if (v.status !== "Watched") return false;
                if (!this.plugin.settings.enableHideWatched) return true;

                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const thresholdDays = this.plugin.settings.hideWatchedDays;

                let finishDate: Date | null = null;
                if (v.endDate) {
                    const parts = v.endDate.split("-");
                    if (parts.length === 3) {
                        finishDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                    }
                }
                
                if (!finishDate && v.updated) {
                    const datePart = String(v.updated).split(" ")[0];
                    const parts = datePart.split("-");
                    if (parts.length === 3) {
                        finishDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                    }
                }

                if (!finishDate) {
                    const mtime = new Date(v.file.stat.mtime);
                    finishDate = new Date(mtime.getFullYear(), mtime.getMonth(), mtime.getDate());
                }

                const diffDays = Math.floor((today.getTime() - finishDate.getTime()) / (24 * 60 * 60 * 1000));

                return diffDays < thresholdDays;
            });
            
            renderVideoList(watchedVideosToRender, "🟢 Watched Logs", "No completed views yet.");
        } else {
            // Compute retrospective stats
            const totalWatched = videos.filter(v => v.status === "Watched").length;
            const ratedVideos = videos.filter(v => v.rating > 0);
            const avgRating = ratedVideos.length > 0 
                ? ratedVideos.reduce((sum, v) => sum + v.rating, 0) / ratedVideos.length 
                : 0;

            // Rendering stats summary cards
            const statsSummary = container.createDiv({ cls: "vrm-retro-stats-summary" });
            
            const addRetroStat = (label: string, value: string) => {
                const card = statsSummary.createDiv({ cls: "vrm-retro-stats-card" });
                card.createDiv({ text: label, cls: "vrm-retro-stats-label" });
                card.createDiv({ text: value, cls: "vrm-retro-stats-value" });
            };

            addRetroStat("Total Logs", String(videos.length));
            addRetroStat("🟢 Watched", String(totalWatched));
            addRetroStat("⭐ Avg Rating", avgRating > 0 ? `${avgRating.toFixed(1)} ★` : "-");

            // --- Section 1: Favorite Genres ---
            container.createEl("h4", { text: "🏷️ Favorite Genres", cls: "vrm-sidebar-section-title" });
            
            const genreMap = new Map<string, { total: number; ratingSum: number; ratingCount: number }>();
            videos.forEach(v => {
                const g = v.genre.trim() || "Uncategorized";
                if (!genreMap.has(g)) {
                    genreMap.set(g, { total: 0, ratingSum: 0, ratingCount: 0 });
                }
                const stat = genreMap.get(g)!;
                stat.total++;
                if (v.rating > 0) {
                    stat.ratingSum += v.rating;
                    stat.ratingCount++;
                }
            });

            const genreStats = Array.from(genreMap.entries()).map(([name, stat]) => {
                const avg = stat.ratingCount > 0 ? stat.ratingSum / stat.ratingCount : 0;
                return { name, total: stat.total, avg };
            }).sort((a, b) => b.total - a.total); // Sort by item count descending

            if (genreStats.length === 0) {
                container.createDiv({ text: "No genres recorded.", cls: "vrm-sidebar-empty-text" });
            } else {
                const listContainer = container.createDiv({ cls: "vrm-sidebar-list" });
                genreStats.slice(0, 5).forEach(g => {
                    const item = listContainer.createDiv({ cls: "vrm-retro-category-item" });
                    
                    const labelDiv = item.createDiv({ cls: "vrm-retro-category-label" });
                    labelDiv.createSpan({ text: g.name, cls: "vrm-retro-category-name" });
                    
                    const ratingText = g.avg > 0 ? `Avg: ${g.avg.toFixed(1)} ★` : "Unrated";
                    labelDiv.createSpan({ text: `${g.total} items (${ratingText})`, cls: "vrm-retro-category-count" });
                    
                    const progressBg = item.createDiv({ cls: "vrm-retro-progress-bg" });
                    const progressFill = progressBg.createDiv({ cls: "vrm-retro-progress-fill" });
                    progressFill.style.width = g.avg > 0 ? `${(g.avg / 5) * 100}%` : "0%";
                });
            }

            // --- Section 2: Hall of Fame (★4 and ★5) ---
            container.createEl("h4", { text: "🏆 Hall of Fame", cls: "vrm-sidebar-section-title" });
            
            const hallOfFame = videos
                .filter(v => v.rating >= 4)
                .sort((a, b) => b.rating - a.rating);

            if (hallOfFame.length === 0) {
                container.createDiv({ text: "No videos rated ★4 or ★5 yet.", cls: "vrm-sidebar-empty-text" });
            } else {
                const listContainer = container.createDiv({ cls: "vrm-sidebar-list" });
                hallOfFame.slice(0, 5).forEach(video => {
                    const item = listContainer.createDiv({ cls: "vrm-retro-hall-item" });
                    
                    const infoContainer = item.createDiv({ cls: "vrm-retro-hall-info" });
                    const titleLink = infoContainer.createEl("a", { 
                        cls: "vrm-retro-hall-title", 
                        text: video.title 
                    });
                    titleLink.addEventListener("click", (e) => {
                        e.preventDefault();
                        this.app.workspace.getLeaf(false).openFile(video.file);
                    });
                    
                    let metaText = `Type: ${video.type}`;
                    if (video.director) metaText += ` | By: ${video.director}`;
                    infoContainer.createDiv({ text: metaText, cls: "vrm-retro-hall-meta" });
                    
                    item.createDiv({ text: "★".repeat(video.rating), cls: "vrm-retro-hall-stars" });
                });
            }

            // --- Section 3: Monthly Log ---
            container.createEl("h4", { text: "📅 Monthly Achievements", cls: "vrm-sidebar-section-title" });
            
            const monthlyMap = new Map<string, number>();
            videos.filter(v => v.status === "Watched").forEach(v => {
                let month = "Unknown";
                if (v.endDate) {
                    month = v.endDate.substring(0, 7); // "YYYY-MM"
                } else if (v.updated) {
                    month = v.updated.substring(0, 7); // "YYYY-MM"
                }
                monthlyMap.set(month, (monthlyMap.get(month) || 0) + 1);
            });

            const monthlyStats = Array.from(monthlyMap.entries())
                .sort((a, b) => b[0].localeCompare(a[0])); // Sort descending by month

            if (monthlyStats.length === 0) {
                container.createDiv({ text: "No completed videos recorded yet.", cls: "vrm-sidebar-empty-text" });
            } else {
                const listContainer = container.createDiv({ cls: "vrm-sidebar-list" });
                monthlyStats.slice(0, 5).forEach(([month, count]) => {
                    const item = listContainer.createDiv({ cls: "vrm-retro-monthly-item" });
                    item.createDiv({ text: month, cls: "vrm-retro-monthly-month" });
                    item.createDiv({ text: `${count} views`, cls: "vrm-retro-monthly-count" });
                });
            }
        }

        // Section Title: Quick Actions
        container.createEl("h4", { text: "⚡ Quick Utilities", cls: "vrm-sidebar-section-title" });
        const quickRow = container.createDiv({ cls: "vrm-sidebar-quick-actions" });

        const addBtn = quickRow.createEl("button", { cls: "vrm-sidebar-action-btn" });
        addBtn.createSpan({ cls: "vrm-sidebar-action-icon", text: "➕" });
        addBtn.createSpan({ text: "Add Entry" });
        addBtn.addEventListener("click", () => this.plugin.openAddVideoModal());

        const dashboardBtn = quickRow.createEl("button", { cls: "vrm-sidebar-action-btn" });
        dashboardBtn.createSpan({ cls: "vrm-sidebar-action-icon", text: "📋" });
        dashboardBtn.createSpan({ text: "Dashboard" });
        dashboardBtn.addEventListener("click", async () => {
            const masterListPath = "Videos/Master Video List.md";
            const file = this.app.vault.getAbstractFileByPath(masterListPath);
            if (file && file instanceof TFile) {
                this.app.workspace.getLeaf(false).openFile(file);
            } else {
                await this.plugin.updateMasterVideoList(true);
            }
        });
    }

    async onClose() {
        // Nothing special to clean up
    }
}

// Core Plugin Entry Class
export default class VideoRecordManager extends Plugin {
    settings!: VideoRecordManagerSettings;

    async onload() {
        console.log("Loading Video Record Manager plugin...");

        await this.loadSettings();

        // 1. Add Stylesheet reference (loaded by Obsidian automatically if styles.css exists)
        
        // 2. Register Sidebar Custom View
        this.registerView(
            SIDEBAR_VIEW_TYPE,
            (leaf) => new VideoStatusSidebarView(leaf, this)
        );

        // 3. Ribbon Icon
        this.addRibbonIcon("video", "Video Record Manager", () => {
            new QuickActionModal(this.app, this).open();
        });

        // 4. Register commands
        this.addCommand({
            id: "open-video-control-panel",
            name: "Open Control Panel (2x2)",
            callback: () => {
                new QuickActionModal(this.app, this).open();
            }
        });

        this.addCommand({
            id: "add-video-entry",
            name: "Add New Video Entry (Movie/Drama/Anime)",
            callback: () => {
                this.openAddVideoModal();
            }
        });

        this.addCommand({
            id: "edit-video-properties",
            name: "Edit Video Properties",
            callback: () => {
                this.openEditVideoModalOfCurrentFile();
            }
        });

        this.addCommand({
            id: "toggle-video-status",
            name: "Change Current Video Status/Rating",
            callback: async () => {
                await this.toggleCurrentVideoStatus();
            }
        });

        this.addCommand({
            id: "open-video-tracker-sidebar",
            name: "Open Video Tracker Sidebar",
            callback: () => {
                this.activateSidebarView();
            }
        });

        // 5. Context Menu Integration
        this.registerEvent(
            this.app.workspace.on("file-menu", (menu, file) => {
                if (!(file instanceof TFile) || !file.path.endsWith(".md")) return;

                const isInVideosFolder = file.path.startsWith("Videos/");

                // Only show for markdown files inside Videos/ folder
                if (isInVideosFolder) {
                    menu.addItem((item) => {
                        item
                            .setTitle("Change Status/Rating")
                            .setIcon("video")
                            .onClick(async () => {
                                await this.toggleBookStatus(file);
                            });
                    });

                    menu.addItem((item) => {
                        item
                            .setTitle("Edit Video Properties")
                            .setIcon("pencil")
                            .onClick(() => {
                                this.openEditVideoModal(file);
                            });
                    });
                }
            })
        );

        // 6. Register Setting Tab
        this.addSettingTab(new VideoRecordManagerSettingTab(this.app, this));

        // 7. Background Event: Sync dashboard when metadata cache changes
        this.registerEvent(
            this.app.metadataCache.on("changed", async (file) => {
                if (!this.settings.enableAutoUpdate) return;
                if (file.path === "Videos/Master Video List.md") return;
                const isInVideosFolder = file.path.startsWith("Videos/");

                if (isInVideosFolder) {
                    await this.updateMasterVideoList(false);
                }
            })
        );

        // Initial dashboard compilation to ensure file exists and is updated
        this.app.workspace.onLayoutReady(async () => {
            await this.updateMasterVideoList(false);
        });
    }

    onunload() {
        console.log("Unloading Video Record Manager plugin...");
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        await this.updateMasterVideoList(false);
    }

    // Opens Sidebar custom view
    async activateSidebarView() {
        const { workspace } = this.app;
        
        let leaf = workspace.getLeavesOfType(SIDEBAR_VIEW_TYPE)[0];
        if (!leaf) {
            const rightLeaf = workspace.getRightLeaf(false);
            if (rightLeaf) {
                leaf = rightLeaf;
                await leaf.setViewState({ type: SIDEBAR_VIEW_TYPE, active: true });
            }
        }
        
        if (leaf) {
            workspace.revealLeaf(leaf);
        }
    }

    // Modal Action: New Video Entry
    openAddVideoModal() {
        new AddVideoModal(this.app, async (result) => {
            const sanitizedTitle = sanitizeFilename(result.title);
            let targetPath = `Videos/${sanitizedTitle}.md`;

            // If series, save within series folder
            if (result.type !== "Movie" && result.seriesName) {
                const sanitizedSeries = sanitizeFilename(result.seriesName);
                targetPath = `Videos/${sanitizedSeries}/${sanitizedTitle}.md`;
            }

            // Standardize folder existence
            const targetFolderStr = targetPath.substring(0, targetPath.lastIndexOf("/"));
            if (targetFolderStr && !this.app.vault.getAbstractFileByPath(targetFolderStr)) {
                await this.app.vault.createFolder(targetFolderStr);
            }

            // Create file if it does not exist
            const existingFile = this.app.vault.getAbstractFileByPath(targetPath);
            if (existingFile) {
                new Notice(`Error: Video entry "${sanitizedTitle}" already exists.`);
                return;
            }

            const now = formatDateTime(new Date());
            let fileContent = `---
title: "${escapeYamlString(result.title)}"
type: "${result.type}"
status: "${result.status}"
director: "${escapeYamlString(result.director)}"
series: "${escapeYamlString(result.seriesName)}"
season: "${escapeYamlString(result.season)}"
episode: "${escapeYamlString(result.episode)}"
genre: "${escapeYamlString(result.genre)}"
subgenre: "${escapeYamlString(result.subgenre)}"
rating: ${result.rating}
updated: ${now}
`;

            if (result.status === "Watched") {
                fileContent += `end_date: ${formatDate(new Date())}\n`;
            }

            fileContent += `---

## Watching Notes

- 

## Final Review


`;

            try {
                const newFile = await this.app.vault.create(targetPath, fileContent);
                new Notice(`Created video entry: "${result.title}"`);
                
                // Open newly created note
                this.app.workspace.getLeaf(false).openFile(newFile);
                
                // Auto-refresh dashboard in background
                await this.updateMasterVideoList(false);
            } catch (err) {
                console.error("Failed to create video file:", err);
                new Notice("Error: Failed to create video entry file.");
            }
        }).open();
    }

    // Modal Action: Edit Current Note Properties
    openEditVideoModalOfCurrentFile() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice("Please open a video note first.");
            return;
        }
        this.openEditVideoModal(activeFile);
    }

    // Modal Action: Edit specific file properties
    openEditVideoModal(file: TFile) {
        const cache = this.app.metadataCache.getFileCache(file);
        const frontmatter = cache?.frontmatter;
        if (!frontmatter) {
            new Notice("No frontmatter metadata found in this file.");
            return;
        }

        const initialData = {
            title: frontmatter.title || file.basename,
            type: frontmatter.type || "Movie",
            director: frontmatter.director || "",
            seriesName: frontmatter.series || "",
            season: frontmatter.season || "",
            episode: frontmatter.episode || "",
            genre: frontmatter.genre || "",
            subgenre: frontmatter.subgenre || "",
            status: frontmatter.status || "To Watch",
            rating: frontmatter.rating || 0
        };

        new EditVideoModal(this.app, initialData, async (result) => {
            const newTitle = result.title;

            // Update Frontmatter content safely
            let content = await this.app.vault.read(file);
            const frontmatterRegex = /^---([\s\S]*?)---/;
            const match = content.match(frontmatterRegex);

            if (!match) {
                new Notice("Error: Invalid note frontmatter.");
                return;
            }

            const rawFrontmatter = match[1];
            const lines = rawFrontmatter.split("\n");
            const updatedProperties: Record<string, string> = {
                title: result.title,
                type: result.type,
                status: result.status,
                director: result.director,
                series: result.seriesName,
                season: result.season,
                episode: result.episode,
                genre: result.genre,
                subgenre: result.subgenre,
                rating: String(result.rating),
                updated: formatDateTime(new Date())
            };

            // Set end_date if status transitioned to Finished
            if (result.status === "Watched") {
                const oldStatus = initialData.status;
                if (oldStatus !== "Watched") {
                    updatedProperties["end_date"] = formatDate(new Date());
                } else if (frontmatter.end_date) {
                    updatedProperties["end_date"] = frontmatter.end_date;
                } else {
                    updatedProperties["end_date"] = formatDate(new Date());
                }
            } else {
                // If moved away from finished, delete end_date from properties list
                updatedProperties["end_date"] = "";
            }

            // Reconstruct frontmatter key by key to preserve missing properties
            const resultKeys = Object.keys(updatedProperties);
            const preservedLines: string[] = [];
            const processedKeys: Set<string> = new Set();

            for (const line of lines) {
                if (!line.trim()) continue;
                const doubleColonIdx = line.indexOf(":");
                if (doubleColonIdx === -1) {
                    preservedLines.push(line);
                    continue;
                }

                const key = line.substring(0, doubleColonIdx).trim();
                if (resultKeys.includes(key)) {
                    processedKeys.add(key);
                    const val = updatedProperties[key];
                    if (val !== "") {
                        if (key === "rating") {
                            preservedLines.push(`${key}: ${val}`);
                        } else {
                            preservedLines.push(`${key}: "${escapeYamlString(val)}"`);
                        }
                    }
                } else {
                    preservedLines.push(line);
                }
            }

            // Append any new properties that did not exist in old frontmatter
            for (const key of resultKeys) {
                if (!processedKeys.has(key)) {
                    const val = updatedProperties[key];
                    if (val !== "") {
                        if (key === "rating") {
                            preservedLines.push(`${key}: ${val}`);
                        } else {
                            preservedLines.push(`${key}: "${escapeYamlString(val)}"`);
                        }
                    }
                }
            }

            const reconstructedFrontmatter = `---\n${preservedLines.join("\n")}\n---`;
            const updatedContent = content.replace(frontmatterRegex, reconstructedFrontmatter);

            try {
                // Save updated properties back to file
                await this.app.vault.modify(file, updatedContent);

                // Handle file renaming or directory moving if Title or Series changed
                let finalFile = file;
                const sanitizedNewTitle = sanitizeFilename(newTitle);
                const oldFilename = file.name;
                const newFilename = `${sanitizedNewTitle}.md`;

                let targetFolder = "Videos";
                if (result.type !== "Movie" && result.seriesName) {
                    targetFolder = `Videos/${sanitizeFilename(result.seriesName)}`;
                }

                const currentParent = file.parent ? file.parent.path : "";
                const sameFolder = (currentParent === targetFolder);
                const sameName = (oldFilename === newFilename);

                if (!sameFolder || !sameName) {
                    // Create target folder if missing
                    if (targetFolder !== "Videos" && !this.app.vault.getAbstractFileByPath(targetFolder)) {
                        await this.app.vault.createFolder(targetFolder);
                    }

                    const targetPath = `${targetFolder}/${newFilename}`;
                    const targetFileExists = this.app.vault.getAbstractFileByPath(targetPath);

                    if (targetFileExists && targetPath !== file.path) {
                        new Notice(`Renaming skipped: "${targetPath}" already exists.`);
                    } else {
                        // Rename/Move via fileManager for complete link resolution
                        await this.app.fileManager.renameFile(file, targetPath);
                        const renamedFile = this.app.vault.getAbstractFileByPath(targetPath);
                        if (renamedFile && renamedFile instanceof TFile) {
                            finalFile = renamedFile;
                        }
                    }
                }

                new Notice("Properties updated successfully.");
                
                // Re-open if active
                if (this.app.workspace.getActiveFile()?.path === file.path) {
                    this.app.workspace.getLeaf(false).openFile(finalFile);
                }

                await this.updateMasterVideoList(false);
            } catch (err) {
                console.error("Failed to edit video metadata:", err);
                new Notice("Error: Failed to save changes.");
            }
        }).open();
    }

    // Opens a popup to change status and rating of a specific file
    async toggleBookStatus(file: TFile, forcedStatus?: string) {
        const cache = this.app.metadataCache.getFileCache(file);
        const frontmatter = cache?.frontmatter;
        if (!frontmatter) {
            new Notice("No metadata frontmatter found in this file.");
            return;
        }

        const currentStatus = frontmatter.status || "To Watch";
        const currentRating = Number(frontmatter.rating) || 0;
        const initialStatus = forcedStatus || currentStatus;

        new StatusRatingModal(this.app, file, initialStatus, currentRating, async (status, rating) => {
            // Update frontmatter content
            let content = await this.app.vault.read(file);
            const frontmatterRegex = /^---([\s\S]*?)---/;
            const match = content.match(frontmatterRegex);

            if (!match) {
                new Notice("Error: Invalid note frontmatter.");
                return;
            }

            const rawFrontmatter = match[1];
            const lines = rawFrontmatter.split("\n");
            const preservedLines: string[] = [];
            let statusUpdated = false;
            let ratingUpdated = false;
            let endDateUpdated = false;

            for (const line of lines) {
                if (!line.trim()) continue;
                const idx = line.indexOf(":");
                if (idx === -1) {
                    preservedLines.push(line);
                    continue;
                }

                const key = line.substring(0, idx).trim();
                if (key === "status") {
                    preservedLines.push(`status: "${status}"`);
                    statusUpdated = true;
                } else if (key === "rating") {
                    preservedLines.push(`rating: ${rating}`);
                    ratingUpdated = true;
                } else if (key === "end_date") {
                    if (status === "Watched") {
                        preservedLines.push(`end_date: "${formatDate(new Date())}"`);
                    } else {
                        // Remove end_date if status is not Watched
                    }
                    endDateUpdated = true;
                } else if (key === "updated") {
                    preservedLines.push(`updated: "${formatDateTime(new Date())}"`);
                } else {
                    preservedLines.push(line);
                }
            }

            if (!statusUpdated) {
                preservedLines.push(`status: "${status}"`);
            }

            if (!ratingUpdated) {
                preservedLines.push(`rating: ${rating}`);
            }

            if (!endDateUpdated && status === "Watched") {
                preservedLines.push(`end_date: "${formatDate(new Date())}"`);
            }

            // Always update updated property
            if (!preservedLines.some(l => l.startsWith("updated:"))) {
                preservedLines.push(`updated: "${formatDateTime(new Date())}"`);
            }

            const reconstructedFrontmatter = `---\n${preservedLines.join("\n")}\n---`;
            const updatedContent = content.replace(frontmatterRegex, reconstructedFrontmatter);

            try {
                await this.app.vault.modify(file, updatedContent);
                new Notice(`"${file.basename}" updated: ${status} (${rating}★)`);

                // Auto-refresh in background
                await this.updateMasterVideoList(false);
            } catch (error) {
                console.error("Failed to update video status and rating frontmatter:", error);
                new Notice("Error: Failed to save changes.");
            }
        }).open();
    }

    // Toggle current active file status
    async toggleCurrentVideoStatus() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice("Please open a video note first.");
            return;
        }
        await this.toggleBookStatus(activeFile);
    }

    // Advanced Sidebar Tool: Mark current episode as Watched, create and open the next episode note
    async createAndOpenNextEpisode(current: any) {
        // 1. Mark current episode as Watched
        await this.toggleBookStatus(current.file, "Watched");

        // 2. Compute next episode string
        const currentEp = current.episode || "01";
        const nextEp = (() => {
            const numRegex = /(\d+)(?!.*\d)/;
            const match = currentEp.match(numRegex);
            if (match) {
                const numStr = match[1];
                const num = parseInt(numStr, 10);
                const nextNum = num + 1;
                let nextNumStr = String(nextNum);
                if (numStr.startsWith("0") && numStr.length > nextNumStr.length) {
                    nextNumStr = nextNumStr.padStart(numStr.length, "0");
                }
                return currentEp.replace(numRegex, nextNumStr);
            }
            return currentEp + " 2";
        })();

        // Format next season/episode badge
        const sStr = current.season ? `S${sanitizeNumberStr(current.season)}` : "S01";
        const eStr = `E${sanitizeNumberStr(nextEp)}`;
        const sanitizedSeries = sanitizeFilename(current.series);
        const nextTitle = `${current.series} ${sStr}${eStr}`;
        const sanitizedNextTitle = sanitizeFilename(nextTitle);
        const targetPath = `Videos/${sanitizedSeries}/${sanitizedNextTitle}.md`;

        // 3. Create next episode note if it doesn't already exist
        const fileExists = this.app.vault.getAbstractFileByPath(targetPath);
        if (fileExists) {
            new Notice(`Next episode "${sanitizedNextTitle}" already exists! Opening it instead.`);
            if (fileExists instanceof TFile) {
                this.app.workspace.getLeaf(false).openFile(fileExists);
            }
            return;
        }

        const now = formatDateTime(new Date());
        const fileContent = `---
title: "${escapeYamlString(nextTitle)}"
type: "${current.type}"
status: "Watching"
director: "${escapeYamlString(current.director)}"
series: "${escapeYamlString(current.series)}"
season: "${escapeYamlString(current.season)}"
episode: "${escapeYamlString(nextEp)}"
genre: "${escapeYamlString(current.genre)}"
subgenre: "${escapeYamlString(current.subgenre)}"
updated: ${now}
---

## Watching Notes

- 

## Final Review


`;

        try {
            // Standardize folder existence
            const targetFolder = `Videos/${sanitizedSeries}`;
            if (!this.app.vault.getAbstractFileByPath(targetFolder)) {
                await this.app.vault.createFolder(targetFolder);
            }

            const newFile = await this.app.vault.create(targetPath, fileContent);
            new Notice(`Enjoying next episode! Created & opened: "${nextTitle}"`);

            // Open the new episode note
            this.app.workspace.getLeaf(false).openFile(newFile);

            // Refreshes the dashboard lists
            await this.updateMasterVideoList(false);
        } catch (err) {
            console.error("Failed to auto-create next episode note:", err);
            new Notice("Error: Failed to auto-generate next episode.");
        }
    }

    // Renders the "Master Video List" Dashboard
    async updateMasterVideoList(showNotification = true) {
        // Buffer delay to allow Obsidian's background indexer to parse the modified markdown file and update its metadata cache
        await new Promise(resolve => setTimeout(resolve, 300));

        const masterListPath = "Videos/Master Video List.md";
        const files = this.app.vault.getMarkdownFiles();

        interface VideoRecord {
            file: TFile;
            title: string;
            type: "Movie" | "Drama" | "Anime";
            status: string;
            director: string;
            series: string;
            season: string;
            episode: string;
            genre: string;
            subgenre: string;
            rating: number;
            updated: string;
            updatedParsed: number;
            endDate: string;
        }

        const videos: VideoRecord[] = [];

        for (const file of files) {
            // Skip dashboard itself
            if (file.path === masterListPath) continue;

            const cache = this.app.metadataCache.getFileCache(file);
            const frontmatter = cache?.frontmatter;

            const isInVideosFolder = file.path.startsWith("Videos/");

            if (isInVideosFolder) {
                const status = frontmatter?.status || "To Watch";
                const type = (frontmatter?.type || "Movie") as "Movie" | "Drama" | "Anime";
                const director = frontmatter?.director || "Unknown";
                const series = frontmatter?.series || "";
                const season = frontmatter?.season || "";
                const episode = frontmatter?.episode || "";
                const genre = frontmatter?.genre || "";
                const subgenre = frontmatter?.subgenre || "";
                const rating = Number(frontmatter?.rating) || 0;
                const updated = frontmatter?.updated || "";
                const endDate = frontmatter?.end_date || "";
                const title = frontmatter?.title || file.basename;

                // Sort updated parsed safely
                let updatedParsed = 0;
                if (updated) {
                    updatedParsed = Date.parse(String(updated).replace(" ", "T"));
                    if (isNaN(updatedParsed)) {
                        updatedParsed = file.stat.mtime;
                    }
                } else {
                    updatedParsed = file.stat.mtime;
                }

                videos.push({
                    file,
                    title,
                    type,
                    status,
                    director,
                    series,
                    season,
                    episode,
                    genre,
                    subgenre,
                    rating,
                    updated: updated ? String(updated) : formatDate(new Date(file.stat.mtime)),
                    updatedParsed,
                    endDate: endDate ? String(endDate) : ""
                });
            }
        }

        // Sort videos: Watching first, then recently updated descending
        videos.sort((a, b) => {
            if (a.status === "Watching" && b.status !== "Watching") return -1;
            if (a.status !== "Watching" && b.status === "Watching") return 1;
            return b.updatedParsed - a.updatedParsed;
        });

        // Compute aggregate stats
        const totalCount = videos.length;
        const toWatchCount = videos.filter(v => v.status === "To Watch").length;
        const watchingCount = videos.filter(v => v.status === "Watching").length;
        const watchedCount = videos.filter(v => v.status === "Watched").length;
        const onHoldCount = videos.filter(v => v.status === "On Hold").length;

        const movieCount = videos.filter(v => v.type === "Movie").length;
        const dramaCount = videos.filter(v => v.type === "Drama").length;
        const animeCount = videos.filter(v => v.type === "Anime").length;

        // Apply Archiving Hide Filter
        let renderedVideos = videos;
        if (this.settings.enableHideWatched) {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const thresholdDays = this.settings.hideWatchedDays;

            renderedVideos = videos.filter(v => {
                if (v.status !== "Watched") return true;
                
                let finishDate: Date | null = null;
                if (v.endDate) {
                    const parts = v.endDate.split("-");
                    if (parts.length === 3) {
                        finishDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                    }
                }
                
                if (!finishDate && v.updated) {
                    const datePart = String(v.updated).split(" ")[0];
                    const parts = datePart.split("-");
                    if (parts.length === 3) {
                        finishDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                    }
                }

                if (!finishDate) {
                    const mtime = new Date(v.file.stat.mtime);
                    finishDate = new Date(mtime.getFullYear(), mtime.getMonth(), mtime.getDate());
                }

                const diffDays = Math.floor((today.getTime() - finishDate.getTime()) / (24 * 60 * 60 * 1000));

                return diffDays < thresholdDays;
            });
        }

        // Build Markdown Dashboard Document
        // --- Retro Analytics Sections ---
        let retroMd = "\n---\n\n### 📊 振り返り分析 (Retrospective Analytics)\n\n";
        
        // 1. Genre stats
        retroMd += "#### 🏷️ ジャンル別集計\n";
        retroMd += "| ジャンル | 視聴完了数 / 総数 | 平均評価 | レーティング進捗 |\n";
        retroMd += "| :--- | :---: | :---: | :--- |\n";
        
        const genreMap = new Map<string, { total: number; watched: number; ratingSum: number; ratingCount: number }>();
        for (const v of videos) {
            const g = v.genre.trim() || "未設定";
            if (!genreMap.has(g)) {
                genreMap.set(g, { total: 0, watched: 0, ratingSum: 0, ratingCount: 0 });
            }
            const stat = genreMap.get(g)!;
            stat.total++;
            if (v.status === "Watched") {
                stat.watched++;
            }
            if (v.rating > 0) {
                stat.ratingSum += v.rating;
                stat.ratingCount++;
            }
        }
        
        const genreStats = Array.from(genreMap.entries()).map(([name, stat]) => {
            const avgRating = stat.ratingCount > 0 ? stat.ratingSum / stat.ratingCount : 0;
            return { name, ...stat, avgRating };
        }).sort((a, b) => b.total - a.total);
        
        for (const g of genreStats) {
            const ratingStars = g.avgRating > 0 ? "★" + g.avgRating.toFixed(1) : "-";
            const barLength = 10;
            const filledLength = Math.round((g.avgRating / 5) * barLength);
            const barStr = "█".repeat(filledLength) + "░".repeat(barLength - filledLength);
            const pctStr = `${Math.round((g.avgRating / 5) * 100)}%`;
            const visualBar = g.avgRating > 0 ? `\`${barStr}\` (${pctStr})` : "-";
            
            retroMd += `| ${g.name} | ${g.watched} / ${g.total} | ${ratingStars} | ${visualBar} |\n`;
        }
        retroMd += "\n";
        
        // 2. Hall of Fame (★4 & ★5)
        retroMd += "#### 🏆 殿堂入り (★4以上のおすすめ作品)\n";
        retroMd += "| 作品名 | タイプ | 監督 / シリーズ | 評価 | 視聴日 |\n";
        retroMd += "| :--- | :--- | :--- | :---: | :--- |\n";
        
        const hallOfFame = videos
            .filter(v => v.rating >= 4)
            .sort((a, b) => {
                if (b.rating !== a.rating) {
                    return b.rating - a.rating;
                }
                const aTime = a.endDate ? Date.parse(a.endDate) : a.updatedParsed;
                const bTime = b.endDate ? Date.parse(b.endDate) : b.updatedParsed;
                return bTime - aTime;
            });
            
        if (hallOfFame.length === 0) {
            retroMd += "| - | - | - | - | - |\n";
        } else {
            for (const v of hallOfFame) {
                const fileLink = `[[${v.file.path}\\|${v.title}]]`;
                const ratingStars = "★".repeat(v.rating);
                let metaInfo = v.director;
                if (v.type !== "Movie" && v.series) {
                    metaInfo = `${v.series} ${v.season ? `S${v.season}` : ""}${v.episode ? `E${v.episode}` : ""}`.trim();
                }
                retroMd += `| ${fileLink} | ${v.type} | ${metaInfo || "-"} | ${ratingStars} | ${v.endDate || "-"} |\n`;
            }
        }
        retroMd += "\n---\n\n## 🍿 Active Watching & Library Directory\n\n| Video Title | Type | Series / Episode Info | Status | Genre | Director | Rating | Last Updated |\n| :--- | :---: | :--- | :---: | :--- | :--- | :---: | :---: |\n";

        let md = `---
title: "Master Video List"
status: "Dashboard"
updated: ${formatDateTime(new Date())}
---

# 🎬 Master Video List Dashboard

<p align="center">
  <img src="https://img.shields.io/badge/Status-Interactive_Dashboard-purple?style=for-the-badge&logo=obsidian" alt="Dashboard Active" />
</p>

## 📊 Watching Statistics

| Metric | Total Counts | Movies | Dramas | Anime |
| :--- | :---: | :---: | :---: | :---: |
| **All Logs** | \`${totalCount}\` | \`${movieCount}\` | \`${dramaCount}\` | \`${animeCount}\` |
| **⚪ To Watch** | \`${toWatchCount}\` | - | - | - |
| **🟡 Watching** | \`${watchingCount}\` | - | - | - |
| **🟢 Watched** | \`${watchedCount}\` | - | - | - |
| **⏸️ On Hold** | \`${onHoldCount}\` | - | - | - |
` + retroMd;

        if (renderedVideos.length === 0) {
            md += `| *No videos logs in list* | | | | | | | |\n`;
        } else {
            renderedVideos.forEach(v => {
                // Link relative path safely
                const fileLink = `[[${v.file.path}\\|${v.title}]]`;

                // Badge mappings using stylesheet class handles
                let statusBadge = "";
                if (v.status === "To Watch") {
                    statusBadge = `<span class="vrm-badge vrm-badge-to-watch">To Watch</span>`;
                } else if (v.status === "Watching") {
                    statusBadge = `<span class="vrm-badge vrm-badge-watching">Watching</span>`;
                } else if (v.status === "Watched") {
                    statusBadge = `<span class="vrm-badge vrm-badge-watched">Watched</span>`;
                } else if (v.status === "On Hold") {
                    statusBadge = `<span class="vrm-badge vrm-badge-on-hold">On Hold</span>`;
                }

                let typeBadge = "";
                if (v.type === "Movie") {
                    typeBadge = `<span class="vrm-badge vrm-badge-movie">Movie</span>`;
                } else if (v.type === "Drama") {
                    typeBadge = `<span class="vrm-badge vrm-badge-drama">Drama</span>`;
                } else if (v.type === "Anime") {
                    typeBadge = `<span class="vrm-badge vrm-badge-anime">Anime</span>`;
                }

                // S/E label
                let infoCell = "";
                if (v.type !== "Movie" && v.series) {
                    const s = v.season ? `S${sanitizeNumberStr(v.season)}` : "";
                    const e = v.episode ? `E${sanitizeNumberStr(v.episode)}` : "";
                    const seLabel = `${s}${e}`.trim();
                    infoCell = `**${v.series}** ${seLabel ? `(\`${seLabel}\`)` : ""}`;
                } else {
                    infoCell = `Standalone`;
                }

                const genreLabel = v.subgenre ? `${v.genre} (${v.subgenre})` : v.genre;
                const ratingStars = v.rating ? "★".repeat(v.rating) : "-";

                md += `| ${fileLink} | ${typeBadge} | ${infoCell} | ${statusBadge} | ${genreLabel || "-"} | ${v.director || "-"} | ${ratingStars} | ${v.updated} |\n`;
            });
        }

        // Add Helpful Usage tip
        md += `
---
> [!TIP]
> **Video Record Manager**: Use the **Ribbon Icon** (video-camera) on your sidebar or search commands (\`CMD+P\` / \`CTRL+P\`) to create new movies, dramas, and anime logs instantly. For TV series, click **Next Ep** on your sidebar tracker to automatically archive current notes and create the next episode log in 1 click! 🎥
`;

        try {
            // Write to master list file (ensuring root Videos directory)
            const rootDirExists = this.app.vault.getAbstractFileByPath("Videos");
            if (!rootDirExists) {
                await this.app.vault.createFolder("Videos");
            }

            const masterFile = this.app.vault.getAbstractFileByPath(masterListPath);
            if (masterFile && masterFile instanceof TFile) {
                await this.app.vault.modify(masterFile, md);
            } else {
                await this.app.vault.create(masterListPath, md);
            }

            if (showNotification) {
                new Notice("Master Video List synced successfully.");
            }
        } catch (err) {
            console.error("Failed to generate master video list dashboard:", err);
            if (showNotification) {
                new Notice("Error: Failed to sync dashboard list.");
            }
        }
    }
}

// Plugin Settings Tab Class
class VideoRecordManagerSettingTab extends PluginSettingTab {
    plugin: VideoRecordManager;

    constructor(app: App, plugin: VideoRecordManager) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl("h2", { text: "🎬 Video Record Manager Settings" });

        new Setting(containerEl)
            .setName("Enable Hide Watched (視聴完了を隠す)")
            .setDesc("Toggle whether watched video entries should be hidden from the master dashboard directory after threshold.")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableHideWatched)
                .onChange(async (value) => {
                    this.plugin.settings.enableHideWatched = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName("Hide Watched Days (非表示までの日数)")
            .setDesc("Specify the threshold of days after which a watched video note is hidden (default is 7 days).")
            .addText(text => text
                .setPlaceholder("7")
                .setValue(String(this.plugin.settings.hideWatchedDays))
                .onChange(async (value) => {
                    const parsed = parseInt(value, 10);
                    if (!isNaN(parsed) && parsed >= 0) {
                        this.plugin.settings.hideWatchedDays = parsed;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName("Auto-update Master List on File Changes (ファイル変更時に自動更新)")
            .setDesc("Automatically rebuild the Master Video List when a video's properties are changed in the background. Disable this to prevent Syncthing sync-conflicts.")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableAutoUpdate)
                .onChange(async (value) => {
                    this.plugin.settings.enableAutoUpdate = value;
                    await this.plugin.saveSettings();
                }));
    }
}
