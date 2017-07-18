(function () {
    var _ = require('underscore');

    var fs = require('fs');

    var mkdirp = require('mkdirp');

    var path = require('path');

    var util = require('util');

    var vm = require('vm');

    // for some reason, both are necessary. Otherwise there will be errors.
    var jasmine = require('jasmine-core');
    var jasminejs = path.join(__dirname, '../../../jasmine-core/lib/jasmine-core/jasmine.js');

    var fileFinder = require('./file-finder');

    var booter = require('./boot');

    var contextObj = {
        window: {
            setTimeout: setTimeout,
            clearTimeout: clearTimeout,
            setInterval: setInterval,
            clearInterval: clearInterval
        },
        String: String,
        Number: Number,
        Function: Function,
        Object: Object,
        Boolean: Boolean,
        setTimeout: setTimeout,
        setInterval: setInterval,
        clearTimeout: clearTimeout,
        console: console
    };

    var loadJasmine = function () {
        var jasmineSrc = fs.readFileSync(jasminejs);
        var context = vm.createContext(contextObj);
        vm.runInContext(jasmineSrc, context, jasminejs);
        global.savedFunctions = {
            setTimeout: setTimeout,
            setInterval: setInterval,
            clearInterval: clearInterval,
            clearTimeout: clearTimeout
        };
        var clockCallback = function (installing, clock) {
            var func, key, _ref;
            if (installing) {
                global.setTimeout = function (callback, millis) {
                    return clock.setTimeout(callback, millis);
                };
                global.setInterval = function (callback, millis) {
                    return clock.setInterval(callback, millis);
                };
                global.clearInterval = function (id) {
                    return clock.clearInterval(id);
                };
                global.clearTimeout = function (id) {
                    return clock.clearTimeout(id);
                };
            } else {
                _ref = global.savedFunctions;
                for (key in _ref) {
                    func = _ref[key];
                    global[key] = func;
                }
            }
        };
        return booter.boot(contextObj.getJasmineRequireObj(), clockCallback);
    };

    var loadHelpersInFolder = function (folder, matcher) {
        var e, file, folderStats, help, helper, helperItem, helperNames, helpers, key, _i, _len;
        folderStats = fs.statSync(folder);
        if (folderStats.isFile()) {
            folder = path.dirname(folder);
        }
        helpers = fileFinder.find([folder], matcher);
        fileFinder.sortFiles(helpers);
        helperNames = [];
        for (_i = 0, _len = helpers.length; _i < _len; _i++) {
            helper = helpers[_i];
            file = helper;
            try {
                helperItem = require(file.replace(/\.*$/, ""));
            } catch (_error) {
                e = _error;
                console.log("Exception loading helper: " + file);
                console.log(e);
                throw e;
            }
            for (key in helperItem) {
                help = helperItem[key];
                global[key] = help;
                helperNames.push(key);
            }
        }
        return global.loadedHelpers = helperNames;
    };

    var removeJasmineFrames = function (text) {
        var line, lines, _i, _len, _ref;
        if (text == null) {
            return;
        }
        lines = [];
        _ref = text.split(/\n/);
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            line = _ref[_i];
            if (line.indexOf(jasminejs) >= 0) {
                continue;
            }
            lines.push(line);
        }
        return lines.join("\n");
    };
    var executeSpecsInFolder = function (options) {
        var defaults, error, jasmine, jasmineEnv, junit, nunit, spec, specsList, _i, _len;
        jasmineEnv = loadJasmine();

        var reporters = require('jasmine-reporters');
        defaults = {
            regExpSpec: new RegExp(".(js)$", "i"),
            stackFilter: removeJasmineFrames
        };
        _.defaults(options, defaults);
        jasmine = jasmineEnv.getEnv();
        specsList = fileFinder.find(options.specFolders, options.regExpSpec);
        if (options.junit) {
            if (options.reporterConfigOpts == null) {
                options.reporterConfigOpts = {};
            }
            junit = new reporters.JUnitXmlReporter(options.reporterConfigOpts);
            jasmine.addReporter(junit);
        }
        if (options.nunit) {
            if (options.reporterConfigOpts == null) {
                options.reporterConfigOpts = {};
            }
            nunit = new reporters.NUnitXmlReporter(options.reporterConfigOpts);
            jasmine.addReporter(nunit);
        }
        if (!(options.junit || options.nunit)) {
            jasmine.addReporter(new jasmineEnv.TerminalReporter(options));
        }
        if (options.growl) {
            jasmine.addReporter(new jasmineEnv.GrowlReporter(options.growl));
        }
        fileFinder.sortFiles(specsList);
        if (_.isEmpty(specsList)) {
            console.error("\nNo Specs Matching " + options.regExpSpec + " Found");
            console.error("Consider using --matchAll or --match REGEXP");
        }
        for (_i = 0, _len = specsList.length; _i < _len; _i++) {
            spec = specsList[_i];
            delete require.cache[spec];
            if (options.debug) {
                console.log("Loading: " + spec);
            }
            try {
                require(spec);
            } catch (_error) {
                error = _error;
                console.log("Exception loading: " + spec);
                console.log(error);
                throw error;
            }
        }
        jasmine.execute();
    };

    module.exports = {
        executeSpecsInFolder: executeSpecsInFolder,
        loadHelpersInFolder: loadHelpersInFolder
    };

}).call(this);
