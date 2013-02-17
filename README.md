PLoader
=======

This project is a dynamic plugin loader module for node.js

It allows a directory of plugins to be reloaded on code change, or when files
are added or removed. Below is an example of usage:

    var plugins = {};
    ploader.watch('./plugins', function(plugin, file) {
        plugins[file] = plugin;
        console.log(['Loaded plugin:',file].join(' '));
    }, function(plugin, file) {
        // Reread callback
        plugins[file] = plugin;
        console.log(['Reread plugin:',file].join(' '));
    }, function(file) {
        // Remove plugin on deletion
        delete plugins[file];
        console.log(['Unloaded plugin:',file].join(' '));
    });

Now the plugin hash can be used async and will always contain fresh plugins