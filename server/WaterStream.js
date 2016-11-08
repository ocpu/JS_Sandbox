'use strict'
/**
 * WaterStream is a Promise polyfill
 *
 * The function onCancel takes a function that runs when the promise is canceled
 *
 * @param {function(resolve, reject, onCancel)} resolver
 * @returns {WaterStream}
 * @public
 * @constructor
 */
function WaterStream(resolver) {
    let state = 'pending',
        value,
        deferred,
        cancellationFunction

    //noinspection JSUnusedGlobalSymbols
    /**
     * If the promise has fulfilled
     *
     * @returns {Boolean}
     * @public
     */
    this.isFulfilled = () => state == 'fulfilled'
    //noinspection JSUnusedGlobalSymbols
    /**
     * If the promise is pending
     *
     * @returns {Boolean}
     * @public
     */
    this.isPending = () => state == 'pending'
    //noinspection JSUnusedGlobalSymbols
    /**
     * If the promise has rejected
     *
     * @returns {Boolean}
     * @public
     */
    this.isRejected = () => state == 'fulfilled'
    //noinspection JSUnusedGlobalSymbols
    /**
     * If the promise has resolved
     *
     * @returns {Boolean}
     * @public
     */
    this.isResolved = () => state == 'resolved'
    /**
     * Returns if the promise is cancelable
     *
     * @returns {Boolean}
     */
    this.isCancelable = () => cancellationFunction != undefined

    const onCancel = fn => cancellationFunction = fn
    const resolve = newValue => {
        try {
            if (newValue && typeof newValue.then === 'function')
                return newValue.then(resolve, reject);
            state = 'resolved';
            value = newValue;

            if (deferred)
                handle(deferred);
        } catch (e) {
            reject(e);
        }
    }
    const reject = reason => {
        state = 'rejected';
        value = reason;

        if (deferred)
            handle(deferred)
    }
    const handle = handler => {
        if (state === 'pending')
            return deferred = handler;
        setTimeout(() => {
            const isResolved = state === 'resolved',
                handlerFN = isResolved ? handler.onResolved : handler.onRejected

            if (!handlerFN)
                return handler[isResolved ? 'resolve' : 'reject'](value)

            let ret
            try {
                ret = handlerFN(value)
                if (!this.isFulfilled())
                    handler.resolve(ret)
            } catch (e) {
                if (!this.isFulfilled())
                    handler.reject(e)
            }
            state = 'fulfilled'
        }, 1)
    }

    /**
     * Resolve what to do with the value
     *
     * @param {function(value)} [onResolved]
     * @param {function(reason)} [onRejected]
     * @returns {WaterStream}
     * @public
     */
    this.then = (onResolved, onRejected) => new WaterStream((resolve, reject) => handle({
        onResolved: onResolved,
        onRejected: onRejected,
        resolve: resolve,
        reject: reject
    }))
    /**
     * Can be useful for error handling in your promise
     * composition.
     *
     * The Error type is not a standard parameter!!!
     * Catch only if it is a specific error *.catch(type, onRejected)
     *
     * @param {function(reason)|Function} [onRejected]
     * @param {function(reason)} [fn]
     * @returns {WaterStream}
     * @public
     */
    this.catch = (onRejected) => new WaterStream((resolve, reject) => handle({
        onResolved: undefined,
        onRejected: onRejected,
        resolve: resolve,
        reject: reject
    }))



    /**
     * NOT STANDARD
     * Do not expect this to work in other Promise libraries.
     *
     * Ensure error catch handles by the onRejected function
     *
     * @param {function(value)} [onResolved]
     * @param {function(reason)} [onRejected]
     * @returns {WaterStream}
     * @public
     */
    this.try = (onResolved, onRejected) => this.then(onResolved).catch(onRejected)
    /**
     * NOT STANDARD
     * Do not expect this to work in other Promise libraries.
     *
     * Make a callback from the promise.
     *
     * @param {Function} cb
     * @param {*} [ctx]
     * @returns {WaterStream|void}
     * @public
     */
    this.callback = (cb, ctx) => {
        if (typeof cb !== 'function') return this;
        this.then(value => cb.call(ctx, null, value))
            .catch(reason => cb.call(ctx, reason))
    }
    /**
     * NOT STANDARD
     *
     * Cancel this promise if it is cancelable
     */
    this.cancel = () => {
        if (this.isCancelable()) {
            cancellationFunction()
            state = 'canceled'
        } else return this
    }



    //noinspection JSCheckFunctionSignatures
    resolver(resolve, reject, onCancel)
}

/**
 * WaterStream.all passes an array of values from
 * all the promises in the iterable object that it was
 * passed. The array of values maintains the order of the
 * original iterable object, not the order that the
 * promises were resolved in. If something passed in the
 * iterable array is not a promise, it's converted to one
 * by {@see WaterStream.resolve}.
 *
 * If any of the passed in promises rejects, the all
 * WaterStream immediately rejects with the value of the
 * promise that rejected, discarding all the other promises
 * whether or not they have resolved. If an empty array is
 * passed, then this method resolves immediately.
 *
 * @param {Array<WaterStream|*>} iterable - An iterable object
 * @returns {WaterStream}
 * @since 1.0
 * @public
 * @static
 */
WaterStream.all = iterable => new WaterStream((resolve, reject) => {
    const values = [];
    console.log(iterable.next);
    iterable = iterable.map(item => item && typeof item.then === 'function' ? item : WaterStream.resolve(item))
    for (let i = 0; i < iterable.length; i++)
        iterable[i].then(value => {
            values[i] = value;
            if (values.length == iterable.length)
                resolve(values);
        }, reject);
})
/**
 * The race function returns a WaterStream that is settled
 * the same way as the first passed water stream to settle.
 * It resolves or rejects, whichever happens first.
 *
 * @param {Array.<WaterStream>} iterable
 * @returns {WaterStream}
 * @since 1.0
 * @public
 * @static
 */
WaterStream.race = iterable => new WaterStream((resolve, reject) => {
    let block = false
    const bfn = (fn, v) => {
        if (block) return
        else block = true
        fn(v)
    }
    for (let i = 0; i < iterable.length; i++)
        iterable[i].then(value => bfn(resolve, value), reason => bfn(reject, reason))
})
/**
 * Returns a WaterStream that is rejected. For debugging purposes
 * and selective error catching, it is useful to make reason
 * an instanceof {@see Error}.
 *
 * @param {Error|String} [reason]
 * @returns {WaterStream}
 * @since 1.0
 * @public
 * @static
 */
WaterStream.reject = reason => new WaterStream((resolve, reject) => reject(reason))
/**
 * Returns a WaterStream that is resolved.
 *
 * @param {T|WaterStream} [value]
 * @returns {WaterStream}
 * @template T
 * @since 1.0
 * @public
 * @static
 */
WaterStream.resolve = value => new WaterStream(resolve => resolve(value))
/**
 * Make a function return a promise.
 *
 * Useful for callback functions
 *
 * @param {Function} fn
 * @param {Number} [argumentCount] - The amount of parameters the function will have
 * @param {Boolean} [hasErrorPar=true] - If the callback has error in callback
 * @returns {Function}
 */
WaterStream.promisify = (fn, argumentCount, hasErrorPar) => {
    argumentCount = argumentCount || Infinity
    hasErrorPar = hasErrorPar || true
    return function () {
        const self = this
        const args = Array.prototype.slice.call(arguments)
        return new WaterStream((resolve, reject) => {
            while (args.length && args.length > argumentCount) args.pop()
            args.push((err, res) => {
                if (!hasErrorPar)
                    resolve['apply'](Array.prototype.slice.call(arguments))
                else if (err) reject(err)
                else resolve(res)
            })
            const result = fn.apply(self, args)
            if (result) resolve(result)
        });
    }
}
/**
 * Make asynchronous code look like synchronous
 *
 * @param {Generator|Function} co
 * @returns {WaterStream}
 */
WaterStream.flow = co => {
    const iterator = co(),
        iterate = iteration => {
            if (iteration.done) return iteration.value
            const value = iteration.value
            return typeof value.then === 'function' ?
                value.then(val => iterate(iterator.next(val))) :
                WaterStream.resolve(iterate(iterator.next(value)))
        }
    return iterate(iterator.next())
}

module.exports = WaterStream