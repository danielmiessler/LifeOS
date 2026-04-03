// Content Parser Web App
class ParserApp {
    constructor() {
        this.parseBtn = document.getElementById('parse-btn');
        this.loadBtn = document.getElementById('load-btn');
        this.urlInput = document.getElementById('url-input');
        this.progressSection = document.getElementById('progress-section');
        this.progressContainer = document.getElementById('progress-container');
        this.resultsSection = document.getElementById('results-section');
        this.resultsContainer = document.getElementById('results-container');
        this.successCount = document.getElementById('success-count');
        this.failedCount = document.getElementById('failed-count');

        this.results = [];
        this.successfulCount = 0;
        this.failedCount = 0;

        this.init();
    }

    init() {
        this.parseBtn.addEventListener('click', () => this.handleParse());
        this.loadBtn.addEventListener('click', () => this.handleLoadExisting());

        // Allow Ctrl+Enter to submit
        this.urlInput.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                this.handleParse();
            }
        });
    }

    async handleLoadExisting() {
        try {
            // Reset state
            this.results = [];
            this.successfulCount = 0;
            this.failedCount = 0;
            this.progressContainer.innerHTML = '';
            this.resultsContainer.innerHTML = '';
            this.progressSection.style.display = 'none';

            // Disable button
            this.loadBtn.disabled = true;
            this.loadBtn.innerHTML = '<span class="btn-icon">⏳</span> Loading...';

            // Load index of available files
            const indexResponse = await fetch('output/index.json');
            if (!indexResponse.ok) {
                throw new Error('Failed to load file index');
            }

            const fileList = await indexResponse.json();

            // Load each JSON file
            for (const filename of fileList) {
                try {
                    const response = await fetch(`output/${filename}`);
                    if (response.ok) {
                        const data = await response.json();
                        this.results.push(data);
                        this.successfulCount++;
                    } else {
                        this.failedCount++;
                    }
                } catch (error) {
                    console.error(`Failed to load ${filename}:`, error);
                    this.failedCount++;
                }
            }

            // Re-enable button
            this.loadBtn.disabled = false;
            this.loadBtn.innerHTML = '<span class="btn-icon">📂</span> Load Existing Results';

            // Show results
            this.showResults();
        } catch (error) {
            this.loadBtn.disabled = false;
            this.loadBtn.innerHTML = '<span class="btn-icon">📂</span> Load Existing Results';
            this.showError('Failed to load existing results: ' + error.message);
        }
    }

    async handleParse() {
        const urls = this.getURLs();

        if (urls.length === 0) {
            this.showError('Please enter at least one URL');
            return;
        }

        // Reset state
        this.results = [];
        this.successfulCount = 0;
        this.failedCount = 0;
        this.progressContainer.innerHTML = '';
        this.resultsContainer.innerHTML = '';

        // Show progress section
        this.progressSection.style.display = 'block';
        this.resultsSection.style.display = 'none';

        // Disable button
        this.parseBtn.disabled = true;
        this.parseBtn.innerHTML = '<span class="btn-icon">⏳</span> Parsing...';

        // Process each URL
        for (let i = 0; i < urls.length; i++) {
            await this.parseURL(urls[i], i + 1, urls.length);
        }

        // Re-enable button
        this.parseBtn.disabled = false;
        this.parseBtn.innerHTML = '<span class="btn-icon">⚡</span> Parse URLs';

        // Show results
        this.showResults();
    }

    getURLs() {
        const text = this.urlInput.value.trim();
        if (!text) return [];

        return text
            .split('\n')
            .map(url => url.trim())
            .filter(url => url && this.isValidURL(url));
    }

    isValidURL(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    async parseURL(url, index, total) {
        const progressItem = this.createProgressItem(url, index, total);
        this.progressContainer.appendChild(progressItem);

        try {
            // Detect content type
            this.updateProgressStatus(progressItem, 'Detecting content type...', 'active');
            await this.delay(800);

            const contentType = this.detectContentType(url);
            this.updateProgressStatus(progressItem, `Type: ${contentType}`, 'active');
            await this.delay(600);

            // Fetch content
            this.updateProgressStatus(progressItem, 'Fetching content...', 'active');
            await this.delay(1200);

            // Extract entities
            this.updateProgressStatus(progressItem, 'Extracting entities...', 'active');
            await this.delay(1500);

            // Analyze content
            this.updateProgressStatus(progressItem, 'Analyzing content...', 'active');
            await this.delay(1000);

            // Generate JSON
            this.updateProgressStatus(progressItem, 'Generating JSON...', 'active');
            await this.delay(800);

            // Create mock result
            const result = this.createMockResult(url, contentType);
            this.results.push(result);
            this.successfulCount++;

            this.updateProgressStatus(progressItem, '✓ Completed successfully', 'success');
            progressItem.classList.remove('active');
            progressItem.classList.add('success');

        } catch (error) {
            this.failedCount++;
            this.updateProgressStatus(progressItem, `✗ Error: ${error.message}`, 'error');
            progressItem.classList.remove('active');
            progressItem.classList.add('error');
        }
    }

    createProgressItem(url, index, total) {
        const item = document.createElement('div');
        item.className = 'progress-item';
        item.innerHTML = `
            <div class="progress-icon spinner">🔄</div>
            <div class="progress-content">
                <div class="progress-url">${this.escapeHtml(url)}</div>
                <div class="progress-status">Processing ${index} of ${total}...</div>
            </div>
        `;
        return item;
    }

    updateProgressStatus(item, status, type) {
        const statusEl = item.querySelector('.progress-status');
        const iconEl = item.querySelector('.progress-icon');

        statusEl.textContent = status;

        if (type === 'success') {
            iconEl.textContent = '✓';
            iconEl.classList.remove('spinner');
        } else if (type === 'error') {
            iconEl.textContent = '✗';
            iconEl.classList.remove('spinner');
        }
    }

    detectContentType(url) {
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            return 'video';
        } else if (url.includes('twitter.com') || url.includes('x.com')) {
            return 'tweet_thread';
        } else if (url.endsWith('.pdf')) {
            return 'pdf';
        } else if (url.includes('substack.com') || url.includes('beehiiv.com')) {
            return 'newsletter';
        } else {
            return 'article';
        }
    }

    createMockResult(url, contentType) {
        const timestamp = new Date().toISOString();
        const uuid = this.generateUUID();
        const domain = new URL(url).hostname;

        return {
            content: {
                id: uuid,
                type: contentType,
                title: this.generateMockTitle(url),
                summary: {
                    short: "This is a mock short summary of the content (1-2 sentences).",
                    medium: "This is a mock medium summary that provides more detail about the content. It includes the main points and key takeaways from the parsed content.",
                    long: "This is a comprehensive mock summary with multiple paragraphs. It covers all the major themes, arguments, and conclusions from the source material. This would typically be much longer and more detailed in a real parsing scenario."
                },
                content: {
                    full_text: "Mock full text content extracted from the source...",
                    transcript: contentType === 'video' ? "Mock transcript..." : null,
                    excerpts: [
                        "Notable quote or excerpt from the content",
                        "Another important point or statistic"
                    ]
                },
                metadata: {
                    source_url: url,
                    canonical_url: url,
                    published_date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
                    accessed_date: timestamp,
                    language: "en",
                    word_count: Math.floor(Math.random() * 3000) + 500,
                    read_time_minutes: Math.floor(Math.random() * 15) + 3,
                    author_platform: this.getAuthorPlatform(contentType)
                }
            },
            people: this.generateMockPeople(),
            companies: this.generateMockCompanies(),
            topics: {
                primary_category: "AI",
                secondary_categories: ["technology", "business"],
                tags: ["artificial-intelligence", "machine-learning", "innovation"],
                keywords: ["AI", "technology", "innovation", "future"],
                themes: ["AI advancement", "technological change"],
                newsletter_sections: ["Headlines", "Analysis"]
            },
            links: [
                {
                    url: url,
                    domain: domain,
                    title: "Source article",
                    description: "Original source material",
                    link_type: "source",
                    context: "Main content source",
                    position: "beginning"
                }
            ],
            sources: [],
            newsletter_metadata: {
                issue_number: null,
                section: null,
                position_in_section: null,
                editorial_note: null,
                include_in_newsletter: false,
                scheduled_date: null
            },
            analysis: {
                sentiment: "neutral",
                importance_score: Math.floor(Math.random() * 5) + 5,
                novelty_score: Math.floor(Math.random() * 5) + 5,
                controversy_score: Math.floor(Math.random() * 5) + 3,
                relevance_to_audience: ["technologists", "ai_researchers"],
                key_insights: [
                    "Key insight 1 from the analysis",
                    "Key insight 2 from the analysis",
                    "Key insight 3 from the analysis"
                ],
                related_content_ids: [],
                trending_potential: ["low", "medium", "high"][Math.floor(Math.random() * 3)]
            },
            extraction_metadata: {
                processed_date: timestamp,
                processing_method: "hybrid",
                confidence_score: 0.7 + Math.random() * 0.25,
                warnings: [],
                version: "1.0.0"
            }
        };
    }

    generateMockTitle(url) {
        const domain = new URL(url).hostname;
        const titles = [
            "Breaking: Major AI Advancement Announced",
            "Understanding Modern Machine Learning Systems",
            "The Future of Artificial Intelligence",
            "New Research Breakthrough in Neural Networks",
            "Industry Analysis: AI Market Trends"
        ];
        return titles[Math.floor(Math.random() * titles.length)] + ` (from ${domain})`;
    }

    generateMockPeople() {
        return [
            {
                name: "John Doe",
                role: "author",
                title: "Senior Researcher",
                company: "Tech Corp",
                social: {
                    twitter: "@johndoe",
                    linkedin: "linkedin.com/in/johndoe",
                    email: null,
                    website: "johndoe.com"
                },
                context: "Article author, expert in AI",
                importance: "primary"
            }
        ];
    }

    generateMockCompanies() {
        return [
            {
                name: "OpenAI",
                domain: "openai.com",
                industry: "AI",
                context: "Main subject of article",
                mentioned_as: "subject",
                sentiment: "positive"
            }
        ];
    }

    getAuthorPlatform(contentType) {
        const platforms = {
            video: 'youtube',
            tweet_thread: 'twitter',
            pdf: 'arxiv',
            newsletter: 'substack',
            article: 'blog'
        };
        return platforms[contentType] || 'other';
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    showResults() {
        console.log('showResults called, results count:', this.results.length);
        this.resultsSection.style.display = 'block';
        this.successCount.textContent = `✓ ${this.successfulCount} successful`;
        this.failedCount.textContent = `✗ ${this.failedCount} failed`;

        console.log('Results container:', this.resultsContainer);
        this.results.forEach((result, index) => {
            try {
                console.log('Creating result item', index, result.content.title);
                const resultItem = this.createResultItem(result, index);
                console.log('Result item created:', resultItem);
                this.resultsContainer.appendChild(resultItem);
                console.log('Result item appended');
            } catch (error) {
                console.error('Error creating result item:', error);
                console.error('Result data:', result);
            }
        });
        console.log('Results rendered, container children:', this.resultsContainer.children.length);
    }

    createResultItem(result, index) {
        const item = document.createElement('div');
        item.className = 'result-item';

        const filename = this.generateFilename(result.content.title);

        item.innerHTML = `
            <div class="result-header" data-index="${index}">
                <div class="result-title">
                    <h3>${this.escapeHtml(result.content.title)}</h3>
                    <p>${filename}</p>
                </div>
                <div class="result-actions">
                    <button class="btn-small download-btn" data-index="${index}">
                        💾 Download
                    </button>
                    <button class="btn-small copy-btn" data-index="${index}">
                        📋 Copy
                    </button>
                </div>
                <span class="expand-icon">▼</span>
            </div>
            <div class="json-viewer" data-index="${index}">
                <pre>${this.syntaxHighlight(JSON.stringify(result, null, 2))}</pre>
            </div>
        `;

        // Add event listeners
        const header = item.querySelector('.result-header');
        header.addEventListener('click', (e) => {
            if (!e.target.closest('button')) {
                this.toggleJSON(index);
            }
        });

        const downloadBtn = item.querySelector('.download-btn');
        downloadBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.downloadJSON(result, filename);
        });

        const copyBtn = item.querySelector('.copy-btn');
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.copyJSON(result);
        });

        return item;
    }

    generateFilename(title) {
        const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
        const sanitized = title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .substring(0, 50);
        return `${timestamp}_${sanitized}.json`;
    }

    toggleJSON(index) {
        const viewer = document.querySelector(`.json-viewer[data-index="${index}"]`);
        const icon = document.querySelector(`.result-header[data-index="${index}"] .expand-icon`);

        viewer.classList.toggle('expanded');
        icon.classList.toggle('expanded');
    }

    downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async copyJSON(data) {
        try {
            await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
            // Could add a toast notification here
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }

    syntaxHighlight(json) {
        return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
            let cls = 'json-number';
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = 'json-key';
                } else {
                    cls = 'json-string';
                }
            } else if (/true|false/.test(match)) {
                cls = 'json-boolean';
            } else if (/null/.test(match)) {
                cls = 'json-null';
            }
            return `<span class="${cls}">${match}</span>`;
        });
    }

    showError(message) {
        alert(message); // Could be replaced with a nicer toast notification
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new ParserApp();
});
