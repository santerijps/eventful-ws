// Client-side Eventful WebSockets


function buildQueryString(queryObject) {

    let queryString = ""
    let queryParams = []

    if (typeof queryObject === "object") {
        for (const key in queryObject) {
            queryParams.push(`${key}=${queryObject[key]}`)
        }
        queryString = "?" + queryParams.join("&")
    }

    return queryString
}


function buildWebSocketURL(host, port, path, query, ssl) {

    host = host || location.hostname
    port = port || location.port
    path = path || location.pathname
    query = buildQueryString(query)

    const url = [(ssl ? "wss://" : "ws://"), host, ":", port, path, query].join("")
    return url
}


function prepareWebSocketURL(url, query, ssl) {
    
    if (typeof url !== "string") {
        throw new Error("WebSocket URL must be a string!")
    }

    if ( !(url.startsWith("ws://") || url.startsWith("wss://")) ) {
        url = (ssl ? "wss://" : "ws://") + url
    }

    return url + buildQueryString(query)
}


function waitForOpenConnection(socket) {
    return new Promise((resolve, reject) => {
        const maxNumberOfAttempts = 10
        const intervalTime = 200 //ms

        let currentAttempt = 0
        const interval = setInterval(() => {
            if (currentAttempt > maxNumberOfAttempts - 1) {
                clearInterval(interval)
                reject(new Error('Maximum number of attempts exceeded'))
            } else if (socket.readyState === socket.OPEN) {
                clearInterval(interval)
                resolve()
            }
            currentAttempt++
        }, intervalTime)
    })
}


/** A class for handling eventful websocket connections. */
class EventfulWebSocket {

    /**
     * Creates an EventfulWebSocket instance.
     * Does not connect to the web socket until the 'connect' method is called.
     * Prepares the web socket URL and throws an error if it fails.
     * 
     * OPTIONS: {
     * 
     *      url: String,
     *      host: String,
     *      port: String | Number,
     *      path: String,
     *      query: Object,
     *      ssl: Boolean,
     *      open: Boolean,
     * 
     * }
     * 
     * @param {object} options - An object containing the required fields
     */
    constructor(options = null) {

        if (typeof window === "undefined") {
            return
        }

        this.events = {}
        this.socket = null

        options = options || {}

        this.url = options.url
            ? prepareWebSocketURL(options.url, options.query, options.ssl)
            : buildWebSocketURL(options.host, options.port, options.path, options.query, options.ssl) 

        if (options.open) {
            this.open()
        }

    }

    /**
     * Connects to the configured web socket.
     * @return {EventfulWebSocket} - Instance of this.
     */
    open() {

        if (typeof window === "undefined") {
            return
        }

        this.socket = new WebSocket(this.url)

        this.socket.onopen = event =>
            this.onOpenHandler && this.onOpenHandler(event)

        this.socket.onclose= event =>
            this.onCloseHandler && this.onCloseHandler(event)

        this.socket.onerror = e =>
            this.onErrorHandler && this.onErrorHandler(e)

        this.socket.onmessage = _event => {
            this.onMessageHandler && this.onMessageHandler(_event.data)
            try {
                const { event, data } = JSON.parse(_event.data)
                this._onMessage(event, data)
            }
            catch {}
        }

        return this
    }
    
    /**
     * Closes the web socket connection.
     * @param {string} reason - The reason for closing the connection.
     * @param {number} code - The reason code for closing the connection.
     */
    close(code, reason) {
        if (this.socket !== null) {
            this.socket.close(code, reason)
        }
        return this
    }

    /**
     * Emits an event which is triggered on the server.
     * 
     * @param {string} event - The name of the event.
     * @param {*} data - The data to be sent to the server.
     */
    async emit(event, data) {

        if (typeof event !== "string") {
            throw new Error("Event name must be a string!")
        }

        const message = JSON.stringify({ event, data })

        if (typeof message !== "string") {
            throw new Error("WebSocket message must be a string!")
        }

        if (this.socket.readyState === WebSocket.CONNECTING) {
            await waitForOpenConnection(this.socket)
        }

        if (this.isOpen()) {
            this.socket.send(message)
        }

        return this
    }

    /**
     * Subscribes to an event. It is possible to subscribe to the same event multiple times.
     * The event is triggered when a server sends a valid message to the client.
     * 
     * @param {string} event - The name of the event to subscribe to.
     * @param {function} handler - The function to be called when the event is dispatched. The 'data' argument is passed to the function call.
     */
    subscribe(event, handler) {

        if (typeof event !== "string") {
            throw new Error("Event name must be a string!")
        }

        if (typeof handler !== "function") {
            throw new Error("Event handler must be a function!")
        }

        if (!(event in this.events)) {
            this.events[event] = []
        }

        this.events[event].push(handler)
        return this
    }

    onOpen(handler) {
        this.onOpenHandler = handler
        return this
    }

    onClose(handler) {
        this.onCloseHandler = handler
        return this
    }

    onError(handler) {
        this.onErrorHandler = handler
        return this
    }

    onMessage(handler) {
        this.onMessageHandler = handler
        return this
    }

    /**
     * Routes the content of the message to the correct event handler(s).
     * 
     * @param {string} event - The name of the event. 
     * @param {*} data - The content of the message.
     */
    _onMessage(event, data) {

        if (typeof event !== "string") {
            throw new Error("Event name must be a string!")
        }

        for (const handler of this.events[event] || []) {
            handler(data)
        }

    }

    isOpen() {
        return this.socket !== null && this.socket.readyState === WebSocket.OPEN
    }

    isClosed() {
        return this.socket !== null && this.socket.readyState === WebSocket.CLOSED
    }

}


module.exports = {
    EventfulWebSocket
}