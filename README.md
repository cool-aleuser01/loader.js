# mage-loader.js

`mage-loader` is a library for browsers to download packages of HTML, CSS and JavaScript from a MAGE
server.


## Instantiation

To use the loader, please add it to the component.json file of your application like so:

```json
{
	"name": "myApp",
	"dependencies": {
		"mage/loader.js": "*"
	}
}
```

To import the loader in your app, simply require it.

```javascript
var loader = require('mage-loader.js');
```


## The Loader API

Below follows the API that the loader exposes. You will see references to the `Package` class, which
is documented below under "The Package API".


### Properties

#### Number timeout

The timeout in milliseconds that is used for HTTP requests to load packages.

#### Number retryInterval

When a package download fails and is automatically retried, this interval in milliseconds will be
waited before retrying. This is to avoid hammering the server.


### Methods

#### configure(Object configuration)

Configures the loader. MAGE will provide the configuration automatically however, so unless you
want to test something or really know what you're doing, **you should not need this function**.

#### setLanguage(string language)

Informs the loader that from here on, you want to download packages that were built for this
particular language. It may be called at any time (for example, after having loaded some packages).
This can be useful when using a platform that provides language as part of a user's profile after
authentication. It's not absolutely required to call this function. The fallback language is `"en"`
(English).

#### setDensity(number density)

Informs the loader that from here on, you want to download packages that were built for this
particular pixel density of the device. This is required when offering assets tailored to several
specific pixel densities (in Apple's terminology, retina and non-retina). It's not absolutely
required to call this function. The fallback density is `1`.

#### setCacheStorage(CacheStorage constructor)

Assigns a storage API to be the preferred API for the caching of packages. By default, and if
available, the browser's LocalStorage API will be used.

#### loadPackage(string packageName, Function callback)

Downloads the package from the server. When possible, the loader maintains a package cache in the
browser's `localStorage` object that is based on a hash of the content that is calculated by the
server. When downloading a package, the loader will send along the known hash and if it still
matches with the hash on the server, the server will inform the loader to simply use the cached
version instead of downloading it.

When the download has finished, the following steps are automatically
executed:

1. If the cached hash matches, load the package from cache, else update the cache with the now
   downloaded package.
2. Parse the package.
3. Emit the "parsed" event.
4. Execute the JavaScript of the package (using component.io, that only registers all modules).
5. Emit the "loaded" event.

#### loadPackages(string[] names, Function callback)

Will call loadPackage, one by one, for each package name you have provided.

#### Package[] listPackages()

Returns an array of all packages loaded so far.

#### Package getPackage(name)

Returns the package object.

#### HTMLDivElement getHtml(string name)

Creates (if this is the first time) and returns the `<div>` container for the given package.

#### HTMLDivElement injectHtml(string name)

Once a package has finished loading, you may add its HTML contents to the document. The loader will
put those contents inside a `<div>` element that it creates, which starts out hidden by a
`display: none;` style. When that is done, it returns the `<div>` container.

#### HTMLDivElement displayPackage(string name)

Will call `injectHtml(name)` if you haven't done that yourself, and then make the package visible by
removing its `display: none;` style. If another package is currently visible, it will make that one
invisible at the same time. The loader will emit a "<name>.close" event for the package it hides,
and a "<name>.display" event for the package it displays. When everything is done, it returns the
`<div>` container of the package that is now displayed.

#### HTMLDivElement getActivePackage()

Returns the package that is currently visible, or `undefined` if no package has been made visible
yet.


### Events

The loader emits events throughout its operations. It also does this to inform you of the state of
the network and server while packages are being downloaded. You can listen for events by calling

```javascript
loader.on('eventname', function (arg1, arg2, etc) {
});
```

The events that the loader emits are documented below.

##### warning: (LoadError error)
##### [packageName].warning: (LoadError error)

A non-fatal problem occurred. This should be logged, but should not interrupt the user experience.

##### error: (LoadError error)
##### [packageName].error: (LoadError error)

A serious error occurred, and loading has been interrupted. This should be logged, and you may have
to take action to guarantee a smooth user experience. For more information, see the chapter below on
"Error handling".

#### online: ()

When the loader detects we are able to download a package, and the state was not "online" before,
it emits this event. Please note that the loader starts out assuming we are online, so if the
connection is stable the whole time, this event should never be emitted.

#### offline: (LoadError error)

When the loader detects we are unable to download a package, due to the fact that we cannot reach
the server, it emits this event. It will automatically keep retrying the download. Once it succeeds,
the "online" event will be emitted.

#### maintenance: (LoadError error)

This is emitted when a server responds with a 503 code, indicating that the server is undergoing
maintenance. Like when offline, the loader will automatically keep retrying to download the package.
The error argument will contain a `response` object. In it, the server may have left a message for
the end user that you may choose to display.

#### parsed: (Package pkg)
#### [packageName].parsed: (Package pkg)

When a download has completed, or when a package has been loaded from cache, it is immediately
parsed into its embedded parts (HTML, CSS, JavaScript, others) as a Package object. Once that the
Package object has been created and populated with its parsed data, it is emitted through this
event.

If you need to do any post processing on the content, while not particularly encouraged, you can do
that during the "parsed" event.

#### loaded: (Package pkg)
#### [packageName].loaded: (Package pkg)

Emitted after the JavaScript of a package has been executed. Please note that component.io code
execution only means that the modules are now registered and `require` can be used to run them.

#### display: (HTMLDivElement container, Package pkg)
#### [packageName].display: (HTMLDivElement container, Package pkg)

Emitted when a package is displayed. The `<div>` element contains the HTML for this package and may
be used to add more HTML content to it.

#### close: (Package pkg)
#### [packageName].close: (Package pkg)

Emitted when a package is being hidden. Only one package is displayed at any time, so this event
is emitted every time a new package is displayed (except the first time, when there is nothing to
hide).


### Error handling

All synchronous errors in the loader are thrown as `Error` objects. Asynchronous errors are emitted
through the "error" event. They are also emitted as "[packageName].error". These errors are of the
custom `LoadError` class and carry the following properties:

- message (string): human readable description of the error.
- response (Object, optional): an object describing the HTTP response that caused the error.
- error (Error, optional): an Error object that may provide more information about the cause.
- isRetrying (boolean): true if the loader is automatically retrying the download, false if the
  error was fatal and the download cannot and should not be retried.
- packageName (string, optional): the name of the package during the loading of which the error
  occurred.

If the error can be recovered from, the loader will automatically attempt to retry an interrupted
load-operation. Fatal errors that cannot be recovered from however, will be instantly returned
to the callback you passed to `loadPackage` or `loadPackages` and emitted with the "error" event.

When you listen for "error" events, you will know if the loader is retrying, simply by looking at
the `loadError.isRetrying` boolean value.

In the case of a fatal error, there is very little you can do besides inform the user. These errors
are the following:

- The loader has not been adequately configured to download packages.
- The JavaScript in this package failed to execute.
- This browser does not support XMLHttpRequest.
- This browser does not support CORS requests (if your configuration requires it).


## The Package API

Whenever you need to change how packages behave, you should probably do so during the "parsed" event
of the loader. This allows you to affect the package before the loader starts to use it.


### Properties

#### string name

The name of the package.

#### Object parentElements

An object that contains, per content-type a reference to a DOM element to which content may be
appended. The default values are:

- text/html: document.body
- text/css: document.head

You may override these if you want content to be appended elsewhere.

#### Object content

An object that contains, per content-type, the string data that is to be transformed into DOM
elements or otherwise. Once transformed, it's removed from this object.

#### Object containers

An object that contains, per content-type, the transformed DOM container element.


### Methods

#### destroy()

Removes all elements from the DOM and removes all references to the elements or their unprocessed
content. This can be useful to clear memory after a package has been used and you know will not be
used again.

#### getHtml()

Creates (if not yet created) the HTML container, then returns it.

#### injectHtml([HTMLElement parent])

Creates (if not yet created) the HTML container, injects it into the given parent or the parent
that is registered in the `parentElements` property, then returns it.

#### ejectHtml()

If the HTML container exists, it is removed from its parent element. It can always be re-injected by
calling `injectHtml()`.

#### showHtml()

Creates (if not yet created) the HTML container, injects it into the given parent or the parent
that is registered in the `parentElements` text/html property, displays it, then returns it.

#### hideHtml()

If the HTML container exists, it is hidden through a "display: none" style property. It can be made
visible again by calling `showHtml()`.

#### getCss()

Creates (if not yet created) the CSS style-container, then returns it.

#### injectCss([HTMLElement parent])

Creates (if not yet created) the CSS style-container, injects it into the given parent or the parent
that is registered in the `parentElements` text/css property, then returns it.

#### ejectCss()

If the CSS style-container exists, it is removed from its parent element. It can always be
re-injected by calling `injectCss()`.
