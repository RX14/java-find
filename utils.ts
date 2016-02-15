import * as Promise from "bluebird"
import {readdir, stat} from "fs"
import {join} from "path"
import {each} from "async"
import * as fs from "fs"

export function allDirectories(directory: string): Promise<Array<string>> {
    return new Promise<Array<string>>((resolve, reject) => {
        readdir(directory, (err, files) => {
            if (err) {
                reject(err)
                return
            }

            let dirs: Array<string> = []
            each(files, (dirName, cb) => {
                let dirPath = join(directory, dirName)
                stat(dirPath, (err, stats) => {
                    if (err) {
                        cb(err)
                        return
                    }

                    if (stats.isDirectory()) {
                        dirs.push(dirPath)
                    }
                    cb()
                })
            }, err => {
                if (err) reject(err)
                else resolve(dirs)
            })
        })
    })
}

export function permutations(array1: Array<any>, array2: Array<any>): Array<Array<any>> {
    let permutations: Array<Array<any>> = []
    for (var i = 0; i < array1.length; i++) {
        for (var j = 0; j < array2.length; j++) {
            permutations.push([array1[i], array2[j]])
        }
    }
    return permutations
}

export function PromiseCache<Result>(func: () => Promise<Result>): () => Promise<Result> {
    let cache: Result
    let currentlyExecutingPromise: Promise<Result>

    return function (): Promise<Result> {
        if (cache != null) return Promise.resolve(cache)
        if (currentlyExecutingPromise != null) return currentlyExecutingPromise

        let promise = func().then((res: Result) => {
            if (cache == null) {
                cache = res
            }
            currentlyExecutingPromise = null

            return res
        })

        currentlyExecutingPromise = promise
        return promise
    }
}

export function flatten<T>(arr: Array<Array<T>>): Array<T> {
    return Array.prototype.concat.apply([], arr)
}

export function canExecute(path: string): Promise<boolean> {
    return new Promise<boolean>(resolve => {
        fs.access(path, fs.X_OK, err => {
            if (err) resolve(false)
            else resolve(true)
        })
    })
}
