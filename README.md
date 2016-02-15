# java-find
Node module for listing java installations, and finding their metadata.

## Installation
```
npm install java-find --save
```

## Usage
Example:
```javascript
var javaFind = require("java-find");
var child_process = require("child_process");

javaFind.getJavas().then(javas => {
    javas
        .filter(java => java.arch == 'x64')
        .forEach(java => {
            child_process.execFile(java.path, ["-jar", "MyJar.jar"]);
        });
});
```

Calling `gatJavas()` will return a promise of an array of java version objects.

Java version objects looks like this:
```javascript
{
    path: "/usr/bin/java",
    arch: "x86", // or x64
    version: { // 1.8.0_74 (Java 8)
        major: 1,
        minor: 8,
        patch: 0,
        update: 74
    }
}
```

You can also use the `setDebug` method to direct debug logging:
```js
javaFind.setDebug(debug => {
    console.log(debug);
})
```
