///<reference path="typings/tsd.d.ts"/>
"use strict"

import * as Promise from "bluebird"
import * as utils from "./utils"
import * as WinReg from "winreg"
import {each as asyncEach} from "async"
import {join, basename} from "path"
import {unique} from "underscore"
import {execFile} from "child_process"

export class JavaVersion {
    major: number
    minor: number
    patch: number
    update: number

    constructor(version: string) {
        const matches = version.match(/(\d+?)\.(\d+?)\.(\d+?)(?:_(\d+))?/)
        this.major = parseInt(matches[1])
        this.minor = parseInt(matches[2])
        this.patch = parseInt(matches[3])
        this.update = parseInt(matches[4] || "0")
    }
}

export class JavaInstall {
    private _path: string
    private _arch: string
    private _version: JavaVersion

    private _gotInfo: boolean
    private _invalid: boolean

    constructor(path: string) {
        this._path = path
        this._gotInfo = false
        this._invalid = false
    }

    get path() {
        return this._path
    }

    get arch() {
        return this._arch
    }

    get version() {
        return this._version
    }

    get invalid() {
        return this._invalid
    }

    /**
     * @internal
     */
    ensureInfo(): Promise<void> {
        if (!this._gotInfo && !this._invalid) {
            return new Promise<void>((resolve, reject) => {
                execFile(this._path, ["-jar", __dirname + "/java/PrintJavaVersion.jar"], {timeout: 1000}, (err, stdoutBuf, stderrBuf) => {
                    if (err) {
                        this._invalid = true
                        reject(err)
                        return
                    }

                    const stdout = stdoutBuf.toString().trim()
                    const lines = stdout.split("\n")

                    const arch = lines[1]
                    switch (arch) {
                        case "32":
                            this._arch = "x86"
                            break
                        case "64":
                            this._arch = "x64"
                            break
                        default:
                            this._arch = "unknown"
                            break
                    }

                    const version = lines[0]
                    this._version = new JavaVersion(version)

                    resolve()
                })
            })
        } else {
            return Promise.resolve()
        }
    }
}

const defaultJava = new JavaInstall("java")

export const getJavas = utils.PromiseCache((): Promise<Array<JavaInstall>> => {
    let javas: Promise<Array<JavaInstall>>
    switch (process.platform) {
        case "win32":
            javas = findJavasWindows()
            break
        case "darwin":
            javas = findJavasMac()
            break
        case "linux":
            javas = findJavasLinux()
            break
        default:
            javas = Promise.resolve([defaultJava])
            break
    }

    return javas
        .filter<JavaInstall>(version => utils.canExecute(version.path))
        .then(versions => unique(versions, v => v.path))

})

//region Linux
const defaultJavasLinux = [
    defaultJava,
    new JavaInstall("/opt/java/bin/java"),
    new JavaInstall("/usr/bin/java")
]

function findJavasLinux(): Promise<Array<JavaInstall>> {
    return Promise.resolve(defaultJavasLinux)
}
//endregion

//region Mac
const defaultJavasMac = [
    defaultJava,
    new JavaInstall("/Applications/Xcode.app/Contents/Applications/Application Loader.app/Contents/MacOS/itms/java/bin/java"),
    new JavaInstall("/Library/Internet Plug-Ins/JavaAppletPlugin.plugin/Contents/Home/bin/java"),
    new JavaInstall("/System/Library/Frameworks/JavaVM.framework/Versions/Current/Commands/java")
]

function findJavasMac(): Promise<Array<JavaInstall>> {
    let javaVersionPromises: Array<Promise<Array<JavaInstall>>> = []
    javaVersionPromises.push(Promise.resolve(defaultJavasMac))

    javaVersionPromises.push(
        utils.allDirectories("/Library/Java/JavaVirtualMachines/")
            .map(dir => [
                new JavaInstall(join(dir, "Contents/Home/bin/java")),
                new JavaInstall(join(dir, "Contents/Home/jre/bin/java"))
            ]).then(utils.flatten)
    )

    javaVersionPromises.push(
        utils.allDirectories("/System/Library/Java/JavaVirtualMachines/")
            .map(dir => [
                new JavaInstall(join(dir, "Contents/Home/bin/java")),
                new JavaInstall(join(dir, "Contents/Commands/java"))
            ]).then(utils.flatten)
    )

    return Promise.all(javaVersionPromises).then(utils.flatten)
}
//endregion

//region Windows
const javaRegKeys = [
    "SOFTWARE\\JavaSoft\\Java Runtime Environment",
    "SOFTWARE\\JavaSoft\\Java Development Kit"
]

const defaultJavasWindows = [
    new JavaInstall("C:/Program Files/Java/jre8/bin/javaw.exe"),
    new JavaInstall("C:/Program Files/Java/jre7/bin/javaw.exe"),
    new JavaInstall("C:/Program Files/Java/jre6/bin/javaw.exe"),
    new JavaInstall("C:/Program Files (x86)/Java/jre8/bin/javaw.exe"),
    new JavaInstall("C:/Program Files (x76)/Java/jre7/bin/javaw.exe"),
    new JavaInstall("C:/Program Files (x66)/Java/jre6/bin/javaw.exe"),
    defaultJava
]

function findJavasWindows(): Promise<Array<JavaInstall>> {
    let javaVersionPromises: Array<Promise<Array<JavaInstall>>> = []
    javaVersionPromises.push(Promise.resolve(defaultJavasWindows))

    javaRegKeys.forEach(key => {
        javaVersionPromises.push(findJavasFromRegistryKey(key, "x64"))
        javaVersionPromises.push(findJavasFromRegistryKey(key, "x86"))
    })

    return Promise.all(javaVersionPromises).then(utils.flatten)
}

function findJavasFromRegistryKey(keyName: string, arch: string): Promise<Array<JavaInstall>> {
    return new Promise<Array<JavaInstall>>((resolve, reject) => {
        let key = new WinReg({ key: keyName, arch: arch })

        // For each subkey of the given key, each of which should be
        key.keys((err: Error, javaKeys: Array<WinReg>) => {
            if (err) {
                resolve([])
                return
            }

            let javaVersions: Array<JavaInstall> = []
            asyncEach<WinReg>(javaKeys, (javaKey, cb) => {
                javaKey.get("JavaHome", (err, javaHome) => {
                    if (err) return

                    let path = join(javaHome.value, "bin", "javaw.exe")
                    javaVersions.push(new JavaInstall(path))
                    cb()
                })
            }, (err) => {
                if (err) reject(err)
                else resolve(javaVersions)
            })
        })
    })
}
//endregion