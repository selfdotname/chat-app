const { MongoClient, ObjectId } = require('mongodb')
const Pusher = require('pusher')
const express = require('express')
const { encrypt, decrypt } = require('./lib')
const cookieParser = require('cookie-parser')
const { config } = require('dotenv')

config({path: '.env', quiet: true})

const pusher = new Pusher({appId: process.env.PUSHER_APP_ID, key: "29ff89f29f081f1763c6", secret: process.env.PUSHER_SECRET, cluster: "eu"})
const client = new MongoClient(process.env.MONGO_URL)
const encKey = process.env.SESSION_SECRET
const app = express()

const main = async () => {
    await client.connect()

    const Users = client.db('ChatApp').collection('Users')
    const Chats = client.db('ChatApp').collection('Chats')
    const Messages = client.db('ChatApp').collection('Messages')

    app.set('view engine', 'ejs')
    app.use(cookieParser())
    app.use(express.urlencoded({extended: true}))
    app.use(express.json())
    app.use(express.static('public'))

    app.get('/', async (req, res) => {
        let token = req.cookies?.session
        if (token) {
            const {uid} = JSON.parse(decrypt(token, encKey))
            const name = (await Users.findOne({_id: new ObjectId(uid)})).name
            if (!name) return res.render('index')
            else return res.redirect('/chats')
        } else {
            const uid = (await Users.insertOne({})).insertedId.toHexString()
            token = encrypt(JSON.stringify({uid}), encKey)
            res.cookie('session', token, {maxAge: 1000 * 60 * 60 * 24 * 7, httpOnly: true})
            return res.render('index')
        }
    })
    app.get('/chats/:id', async (req, res) => {
        const id = req.params.id
        const token = req.cookies?.session
        if (!token) return res.redirect('/') 
        if (token) {
            const {uid} = JSON.parse(decrypt(token, encKey))
            const name = (await Users.findOne({_id: new ObjectId(uid)})).name
            if (!name) return res.render('index')
        } 
        const {uid} = JSON.parse(decrypt(token, encKey))
        const messages = await Messages.aggregate([{$match: {chatId: new ObjectId(id)}}, {$lookup: {from: 'Chats', localField: 'chatId', foreignField: '_id', as: 'chat'}}, {$lookup: {from: 'Users', localField: 'senderId', foreignField: '_id', as: 'sender'}}, {$unwind: '$chat'}, {$unwind: '$sender'}]).toArray()
        return res.render('messages', {messages, id})
    })
    app.get('/chats', async (req, res) => {
        const token = req.cookies?.session
        if (!token) return res.redirect('/')
        if (token) {
            const {uid} = JSON.parse(decrypt(token, encKey))
            const name = (await Users.findOne({_id: new ObjectId(uid)})).name
            if (!name) return res.render('index')
        } 
        const {uid} = JSON.parse(decrypt(token, encKey))
        const chats = await Chats.aggregate([{$match: {$or: [{user1Id: new ObjectId(uid)}, {user2Id: new ObjectId(uid)}]}}, {$lookup: {from: 'Users', localField: 'user1Id', foreignField: '_id', as: 'user1'}}, {$lookup: {from: 'Users', localField: 'user2Id', foreignField: '_id', as: 'user2'}}, {$unwind: '$user1'}, {$unwind: '$user2'}, {$project: {user1Id: 0, user2Id: 0}}]).toArray()
        const name = (await Users.findOne({_id: new ObjectId(uid)})).name
        return res.render('chats', {chats, uid, name})
    })
    app.get('/api/chats', async (req, res) => {
        const token = req.cookies?.session
        if (!token) return res.end() 
        const {uid} = JSON.parse(decrypt(token, encKey))
        const chats = await Chats.aggregate([{$match: {$or: [{user1Id: new ObjectId(uid)}, {user2Id: new ObjectId(uid)}]}}, {$lookup: {from: 'Users', localField: 'user1Id', foreignField: '_id', as: 'user1'}}, {$lookup: {from: 'Users', localField: 'user2Id', foreignField: '_id', as: 'user2'}}, {$unwind: '$user1'}, {$unwind: '$user2'}, {$project: {user1Id: 0, user2Id: 0}}]).toArray()
        return res.json(chats)
    })

    app.post('/', async (req, res) => {
        const name = req.body?.name
        const token = req.cookies?.session
        if (!name || !token) return res.end('cannot complete request')
        const {uid} = JSON.parse(decrypt(token, encKey))
        await Users.updateOne({_id: new ObjectId(uid)}, {$set: {name}})
        return res.redirect('/chats')
    })
    app.post('/chats', async (req, res) => {
        const recipientId = req.body?.recipient_id
        const token = req.cookies?.session
        if (!recipientId || !token) return res.end('cannot complete request') 
        const {uid} = JSON.parse(decrypt(token, encKey))
        if (!/^[a-zA-Z0-9]{24}$/.test(recipientId) || recipientId == uid) return res.end('invalid request')
        const recipient = await Users.findOne({_id: new ObjectId(recipientId)})
        if (!recipient) return res.end('invalid recipient')
        const chat = await Chats.findOne({$or: [{user1Id: new ObjectId(uid), user2Id: new ObjectId(recipientId)}, {user1Id: new ObjectId(recipientId), user2Id: new ObjectId(uid)}]})
        if (chat) return res.redirect('/chats')
        const _id = new ObjectId()
        await Chats.insertOne({_id, user1Id: new ObjectId(uid), user2Id: new ObjectId(recipientId), channel: 'chat-' + _id.toHexString()})
        await pusher.trigger('chat-app', recipientId, {})
        return res.redirect('/chats')
    })
    app.post('/api/message', async (req, res) => {
        const chatId = req.query?.chat_id
        const token = req.cookies?.session
        const message = req.body?.message
        console.log({token, chatId, message}) // <-------- get rid of this later in production
        if (!token || !chatId || !message) return res.end() 
        const {uid} = JSON.parse(decrypt(token, encKey))
        await Messages.insertOne({chatId: new ObjectId(chatId), senderId: new ObjectId(uid), message, timestamp: Date.now()})
        const messages = await Messages.aggregate([{$match: {chatId: new ObjectId(chatId)}}, {$sort: {timestamp: 1}}, {$lookup: {from: 'Users', localField: 'senderId', foreignField: '_id', as: 'sender'}}, {$unwind: '$sender'}, {$lookup: {from: 'Chats', localField: 'chatId', foreignField: '_id', as: 'chat'}}, {$unwind: '$chat'}, {$project: {senderId: 0, chatId: 0}}]).toArray()
        await pusher.trigger('chat-' + chatId, 'new-message', messages)
        return res.end()
    })

    app.listen(80, () => console.log('live!'))
}

main()