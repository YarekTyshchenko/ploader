var fs = require('fs');
var _ = require('underscore');
var path = require('path');

function Ploader() {
    /**
     * Helper function to do initial read of a directory
     * @param  {String} folder
     * @return {Array} Array of valid files
     */
    var getNewPlugins = function(folder) {
        var newPlugins = [];
        fs.readdirSync(folder).forEach(function(file) {
            // Only read files ending in JS extension
            if (! /\.js$/i.test(file)) return;
            newPlugins.push(file);
        });
        return newPlugins;
    }

    /**
     * Require and catch any errors
     * @param  {String}   file          File name to require
     * @param  {Function} callback      On Success
     * @param  {function} errorCallback On Error
     */
    var safeRequire = function(file, callback, errorCallback) {
        errorCallback = errorCallback || function(e){
            console.log(e);
        };

        try {
            var plugin = require(file);
            callback(plugin);
        } catch (e) {
            console.log('Error in plugin:', file);
            console.log(e);
        }
    }

    /**
     * Read the dir for current plugin files
     * @param  {Object} pluginFiles    Cache of plugin files and watch descriptors
     * @param  {String} folder         Path to folder
     * @param  {Function} addCallback
     * @param  {Function} readCallback
     * @param  {Function} removeCallback
     */
    var readPlugins = function(pluginFiles, folder, addCallback, readCallback, removeCallback) {
        var newPlugins = getNewPlugins(folder);
        // Load added plugins
        _.difference(newPlugins, Object.keys(pluginFiles)).forEach(function(file) {
            var filename = path.resolve([folder,file].join('/'));
            var resolvedPath = path.resolve(folder);
            // Load the plugin
            safeRequire(filename, function(plugin) {
                addCallback(plugin, file);
            });
            // Attach fs watcher
            var watch = fs.watch(filename, (function(){
                var previous = fs.statSync(filename).mtime.getTime() / 1000;
                return function() {
                    // Check file mtime
                    if (! fs.existsSync(filename)) return;
                    var current = fs.statSync(filename).mtime.getTime() / 1000;
                    // Reload plugin memory location above
                    if (current > previous) {
                        // Remove previous cache file .cache.js_8273642
                        var previousCacheName = [resolvedPath,'/','.',file,'_',previous].join('');
                        if (fs.existsSync(previousCacheName)) {
                            fs.unlinkSync(previousCacheName);
                        }
                        // Read file contents into cache file
                        var currentCacheName = [resolvedPath,'/','.',file,'_',current].join('');
                        fs.writeFileSync(currentCacheName, fs.readFileSync(filename));

                        // Require cache file
                        safeRequire(currentCacheName, function(plugin) {
                            readCallback(plugin, file);
                        });
                    }
                    previous = current;
                }
            })());

            pluginFiles[file] = watch;
        });
        // Unload removed plugins
        _.difference(Object.keys(pluginFiles), newPlugins).forEach(function(file) {
            // Delete the plugin from plugins hash
            removeCallback(file);
            // Unwatch the file
            pluginFiles[file].close();
            delete pluginFiles[file];
        });
    }

    return {
        /**
         * Listen to changes to this directory
         * @param  {String}   pluginPath      Path to the watched dir
         * @param  {Function} addCallback
         * @param  {Function} readCallback
         * @param  {Function} removeCallback
         * @return {Object} Object used for unwatch function
         */
        watch: function(pluginPath, addCallback, readCallback, removeCallback) {
            // Clear the dir of previous cache files
            fs.readdirSync(pluginPath).forEach(function(file) {
                if (/\..*_\d+$/.test(file)) {
                    // Potentially dangerous
                    console.log('Removing old cache file:',file);
                    fs.unlinkSync(path.resolve([pluginPath,file].join('/')));
                }
            });
            var pluginFiles = {};
            readPlugins(pluginFiles, pluginPath, addCallback, readCallback, removeCallback);
            // Watch folder for plugin additions or deletions
            var watch = fs.watch(pluginPath, function() {
                readPlugins(pluginFiles, pluginPath, addCallback, readCallback, removeCallback);
            });
            return {
                plugins: pluginFiles,
                watch: watch
            }
        },

        /**
         * Stop watching the a directory
         * @param  {object} watch Object returned by watch call
         */
        unwatch: function(watch) {
            watch.watch.close();
            _.forEach(pluginFiles, function(file, w) {
                w.close();
            });
        }
    }
}

module.exports = new Ploader();