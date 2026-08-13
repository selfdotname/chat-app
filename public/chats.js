// import Pusher from "pusher-js";

const pusher = new Pusher('29ff89f29f081f1763c6', {cluster: 'eu'})
const ul = document.querySelector('ul')
const uid = document.querySelector('.uid').textContent

const channel = pusher.subscribe('chat-app')
channel.bind(uid, async () => {
    const chats = await (await fetch('/api/chats')).json()
    ul.innerHTML = ''
    for (const chat of chats) {
        ul.innerHTML += `
        <li>
            <a href="/chats/${chat._id} %>" 
                class="inline-block p-4 bg-blue-200 hover:bg-blue-300 rounded-lg hover:shadow">
                A chat between ${chat.user1?.name || chat.user1._id} and ${chat.user2?.name || chat.user2._id}
            </a>
        </li>
        `
    }
})

window.addEventListener('pagehide', () => {
    channel.unbind(uid)
    pusher.disconnect()
})