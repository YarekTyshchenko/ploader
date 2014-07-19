PLoader
=======

This project is a dynamic plugin loader module for node.js

Originally written for an IRC bot

It allows a directory of plugins to be reloaded on code change, or when files
are added or removed. Below is an example of usage:

    var fs = require('fs');
    var ploader = require('ploader');

    var plugins = {};
    var loader = ploader.attach('./plugins', {
        add: function(plugin, file) {
            plugins[file] = plugin;
            console.log('Loaded plugin:', file);
        },
        read: function(plugin, file) {
            // Reread callback
            plugins[file] = plugin;
            console.log('Reread plugin:', file);
        },
        remove: function(file) {
            // Remove plugin on deletion
            delete plugins[file];
            console.log('Unloaded plugin:', file);
        },
        error: function(file, e) {
            console.log('Error in plugin:', file, e);
        }
    });

    // Reload with watch, or manually
    fs.watch('./plugins', function() {
        loader.reload();
    });

Now the plugin hash can be used async and will always contain fresh plugins

Changes
=======

The fs.watch api is ridiculously buggy which forced me to remove it from the
module, opting to instead have an option to rescan the plugins manually. At least
this way is slightly more reliable than watching every file.

You will now have to keep the loader closure somewhere to be able to call reload
on it
