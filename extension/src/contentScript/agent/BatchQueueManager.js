/**
 * BatchQueueManager
 * 
 * Manages a batch application queue for candidate job applications.
 * Allows users to queue multiple job listings from LinkedIn, Indeed, Glassdoor, etc.,
 * and processes them sequentially with randomized human delays (15–30s) to prevent bot detection.
 */

class BatchQueueManager {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
        this.currentJobId = null;
        this.minDelaySeconds = 15;
        this.maxDelaySeconds = 30;
    }

    /**
     * Load queue from chrome.storage.local
     */
    async init() {
        if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
            return;
        }

        const data = await new Promise(resolve => {
            chrome.storage.local.get(['applicationQueue', 'isQueueProcessing'], resolve);
        });

        this.queue = Array.isArray(data.applicationQueue) ? data.applicationQueue : [];
        this.isProcessing = !!data.isQueueProcessing;
    }

    /**
     * Add a job to the queue
     */
    async enqueue(jobData) {
        const id = jobData.id || `job_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        
        // Prevent duplicate URLs in queue
        const exists = this.queue.some(j => j.url === jobData.url && j.status === 'queued');
        if (exists) {
            return { success: false, message: 'Job already exists in queue.' };
        }

        const item = {
            id,
            url: jobData.url || '',
            title: jobData.title || 'Target Position',
            company: jobData.company || 'Target Company',
            platform: jobData.platform || 'General',
            status: 'queued', // 'queued' | 'in_progress' | 'completed' | 'failed'
            addedAt: Date.now(),
            completedAt: null,
            error: null
        };

        this.queue.push(item);
        await this.persist();
        return { success: true, item };
    }

    /**
     * Remove an item from the queue
     */
    async removeItem(id) {
        this.queue = this.queue.filter(j => j.id !== id);
        await this.persist();
        return true;
    }

    /**
     * Update job status
     */
    async updateStatus(id, status, error = null) {
        const item = this.queue.find(j => j.id === id);
        if (item) {
            item.status = status;
            if (status === 'completed' || status === 'failed') {
                item.completedAt = Date.now();
            }
            if (error) {
                item.error = error;
            }
            await this.persist();
        }
    }

    /**
     * Get all queued jobs
     */
    getQueuedJobs() {
        return this.queue.filter(j => j.status === 'queued');
    }

    /**
     * Get next job to execute
     */
    getNextJob() {
        return this.queue.find(j => j.status === 'queued') || null;
    }

    /**
     * Calculate human-like random delay
     */
    getRandomDelayMs() {
        const minMs = this.minDelaySeconds * 1000;
        const maxMs = this.maxDelaySeconds * 1000;
        return Math.floor(minMs + Math.random() * (maxMs - minMs));
    }

    /**
     * Clear completed jobs
     */
    async clearCompleted() {
        this.queue = this.queue.filter(j => j.status !== 'completed');
        await this.persist();
    }

    /**
     * Save queue to storage
     */
    async persist() {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            await new Promise(resolve => {
                chrome.storage.local.set({
                    applicationQueue: this.queue,
                    isQueueProcessing: this.isProcessing
                }, resolve);
            });
        }
    }
}

if (typeof window !== 'undefined') {
    window.BatchQueueManager = BatchQueueManager;
    window.__batchQueueManagerInstance = new BatchQueueManager();
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BatchQueueManager;
}
