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
 */
function ResourcePool (options) {
	this.max = options.max || 1;
	this.maxUses = options.maxUses || 1;
	this.create = options.create || function () {};
	this.destroy = options.destroy || function () {};
	this.active = 0;
	this.resources = new Array(this.max);
	this.resourceActive = new Array(this.max);
	this.resourceUses = new Array(this.max);
}
/**
 * Get a Resource from the pool of resources
 *   Create a new Resource if necessary
 *
 * @return {Resource|null}
 *   returns null if pool is full
 */
ResourcePool.prototype.acquire = function () {
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
