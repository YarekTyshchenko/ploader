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
        errorCallback = errorCallback || function(file, e){
            console.log('Error in plugin:', file, e);
        };

        try {
            var plugin = require(file);
            callback(plugin);
        } catch (e) {
            errorCallback(file, e);
        }
    }

    /**
     * Read the dir for current plugin files
     * @param  {Object} pluginFiles    Cache of plugin files and watch descriptors
     * @param  {String} folder         Path to folder
     * @param  {Object} callbacks
     */
    var readPlugins = function(pluginFiles, folder, callbacks) {
        var newPlugins = getNewPlugins(folder);
        // Unload removed plugins
        var resolvedPath = path.resolve(folder);
        _.difference(Object.keys(pluginFiles), newPlugins).forEach(function(file) {
            var mtime = pluginFiles[file];
            // Remove previous cache file .cache.js_8273642
            var previousCacheName = [resolvedPath,'/','.',file,'_',mtime].join('');
            if (fs.existsSync(previousCacheName)) {
                fs.unlinkSync(previousCacheName);
            }

            callbacks.remove(file);
            delete pluginFiles[file];
        });

        // Refresh changed plugins
        _.forEach(pluginFiles, function(mtime, file) {
            var filename = path.resolve([folder,file].join('/'));
            var current = fs.statSync(filename).mtime.getTime() / 1000;
            if (current > mtime) {
                // Remove previous cache file .cache.js_8273642
                var previousCacheName = [resolvedPath,'/','.',file,'_',mtime].join('');
                if (fs.existsSync(previousCacheName)) {
                    fs.unlinkSync(previousCacheName);
                }
                // Read file contents into cache file
                var currentCacheName = [resolvedPath,'/','.',file,'_',current].join('');
                fs.writeFileSync(currentCacheName, fs.readFileSync(filename));

                // Require cache file
                safeRequire(currentCacheName, function(plugin) {
                    callbacks.read(plugin, file);
                }, callbacks.error);
                pluginFiles[file] = current;
            }
        });

        // Load added plugins
        _.difference(newPlugins, Object.keys(pluginFiles)).forEach(function(file) {
            var filename = path.resolve([folder,file].join('/'));
            // Load the plugin
            safeRequire(filename, function(plugin) {
                callbacks.add(plugin, file);
            }, callbacks.error);
            var current = fs.statSync(filename).mtime.getTime() / 1000;
            pluginFiles[file] = current;
        });
        return;
    }

    return {
        /**
         * Listen to changes to this directory
         * @param  {String}   pluginPath      Path to the watched dir
         * @param  {Object} Callbacks
         * @return {Object} Object used for unwatch function
         */
        attach: function(pluginPath, callbacks) {
            // Clear the dir of previous cache files
            fs.readdirSync(pluginPath).forEach(function(file) {
                if (/\..*_\d+$/.test(file)) {
                    // Potentially dangerous
                    //console.log('Removing old cache file:',file);
                    fs.unlinkSync(path.resolve([pluginPath,file].join('/')));
                }
            });
            var pluginFiles = {};
            readPlugins(pluginFiles, pluginPath, callbacks);
            return {
                reload: function() {
                    // Rescan the directory and rerequire modules
                    readPlugins(pluginFiles, pluginPath, callbacks);
                }
            };
        }
    }
}

module.exports = new Ploader();
