/**
 * Class for managing a pool of resources
 *
 * @param {object} options
 * @param {int} options.max
 *   Maximum number of resources to keep
 * @param {int} options.maxUses
 *   Maximum number of times a resource may be used 
 * @param {function} options.create
 *   Called to create a new Resource
 * @param {function} options.destroy
 *   Called to destroy an resource, after it is used up
 *   -- @param {Resource}
 * @param {function} options.task
 *   Called to process a task
 *   -- @param {object} task
 *   -- @param {Resouce} resource
 * @param {function} options.complete
 *   Called when Pool runs out of tasks
 */
function ResourcePool (options) {
	this.max = options.max || 1;
	this.maxUses = options.maxUses || 1;
	this.create = options.create || function () {};
	this.destroy = options.destroy || function () {};
	this.task = options.task || function () {};
	this.complete = options.complete || function () {};
	this.active = 0;
	this.resources = new Array(this.max);
	this.resourceActive = new Array(this.max);
	this.resourceUses = new Array(this.max);
	this.tasks = [];
}
ResourcePool.prototype.churn = function () {
	while (this.tasks.length && this.active < this.max) {
		var resource = this.get();
		var task = this.tasks.unshift();
		setImmediate(this.task.bind(this, task, resource));
	}
};
/**
 * Apply a new task to the queue
 *
 * @param {object[]} task
 *   Called when a "resource" becomes available to handle the task
 */
ResourcePool.prototype.enqueue = function (tasks) {
	this.tasks.push.apply(this.tasks, tasks);
	this.churn();
};
/**
 * Get a Resource from the pool of resources
 *   Create a new Resource if necessary
 *
 * @return {Resource|null}
 *   returns null if pool is full
 */
ResourcePool.prototype.get = function () {
	for (var i = 0; i < this.max; i++) {
		if (!this.resourceActive[i]) {
			if (!this.resources[i]) {
				this.resources[i] = this.create();
				this.resourceUses[i] = 0;
			}
			this.resourceActive[i] = true;
			this.resourceUses[i]++;
			this.active++;
			return this.resources[i];
		}
	}
	return null;
};
/**
 * Release a Resource back to the pool
 *   If a Resource has been used to the max, it is destroyed
 *
 * @param {Resource} resource
 *   The Resource to release back to the pool
 */
ResourcePool.prototype.release = function (resource) {
	for (var i = 0; i < this.max; i++) {
		if (this.resources[i] === resource) {
			if (this.resourceUses[i] >= this.maxUses) {
				resource.destroy();
				this.resources[i] = null;
				this.resourceUses[i] = 0;
			}
			this.resourceActive[i] = false;
			this.active--;
		}
	}
	if (this.tasks.length) {
		this.churn();
	}
	else if (this.active < 1) {
		this.drain();
		this.complete();
	}
};
/**
 * Destroy all resources
 */
ResourcePool.prototype.drain = function () {
	for (var i = 0; i < this.max; i++) {
		if (this.resources[i]) {
			this.destroy(this.resources[i]);
			this.resourceUses[i] = 0;
			this.resourceActive[i] = false;
		}
	}
	this.active = 0;
};

module.exports = ResourcePool;
