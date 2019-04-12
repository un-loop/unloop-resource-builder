const compose = require('koa-compose');
const convert = require('koa-convert');
const Resource = require('koa-resource-router');
const checkPermission = require("unloop-check-permission").roles;

const wrapExport = (exp, permissions, entryPoint) =>
    function*(next) {
        if (permissions) {
            if (!checkPermission(this, permissions.default) || !checkPermission(this, permissions[entryPoint])) {
                this.throw(403, "Not Authorized");
            }
        }

        yield convert.back(exp[entryPoint]);
    }

module.exports = (basePath) => (...middleware) => (entity) => {

    const resourceModule = require(`${basePath}/resources/${entity}.js`);
    const importedResorce = resourceModule(require(`${basePath}/entity/${entity}.js`));

    const builtResource = {};
    for(let entryPoint in importedResorce) {
        builtResource[entryPoint] = wrapExport(importedResorce, resourceModule.permissions, entryPoint);
    }

    const resource = new Resource(entity, ...middleware.map((m) => convert.back(m)), builtResource);
    const oldMiddleware = resource.middleware.bind(resource);
    const oldAdd = resource.add.bind(resource);
    resource.middleware = () => convert(oldMiddleware());
    resource.add = (r) => {  // we need to replace the add method on Resource since it does not chain middleware of nested resources, with a method that does.
        oldAdd(r);
        const lastMiddleware = resource.middleware.bind(resource); // need to capture context of middleware at time of add() invocation to ensure dynamic chaining of composition
        resource.middleware = () => compose([convert(r.middleware()), lastMiddleware()]); // watch composition order, we want nested resources to trigger first, ensuring a depth-first traversal
                                                                                          // e.g. /api/orders/1/notes/5 will trigger the notes handler before orders
                                                                                          // we will trigger the last added resource first amongst same nesting level, but that should be ok
                                                                                          // since they should have distinct routes
    }

    return resource;
}
