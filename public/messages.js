// import Pusher from 'pusher-js'

const pusher = new Pusher('29ff89f29f081f1763c6', {cluster: 'eu'})
const chatId = new URL(window.location.href).pathname.split('/')[2]
const ul = document.querySelector('.messages')
const formSubmissionBtn = document.querySelector('form button')

const channel = pusher.subscribe('chat-' + chatId)
channel.bind('new-message', data => {
    ul.innerHTML = ''
    for (const message of data) {
        ul.innerHTML += `
        <li>
            <div>${message.sender?.name || message.sender._id}: ${message.message}</div>
            <small class="font-light">${new Date(message.timestamp).toLocaleString()}</small>
        </li>
        `
    }
    ul.scrollTo({
        behavior: "smooth",
        top: ul.scrollHeight
    })
})

document.querySelector('form').addEventListener('submit', async e => {
    e.preventDefault()
    formSubmissionBtn.disabled = true
    const formData = new FormData(e.target)
    const message = formData.get('message')
    const chatId = formData.get('chat_id')
    await fetch('/api/message?chat_id=' + chatId, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({message})})
    e.target.reset()
    formSubmissionBtn.disabled = false
})

window.addEventListener('pagehide', () => {
    channel.unbind('new-message')
    pusher.disconnect()
})

window.addEventListener('DOMContentLoaded', () => {
    ul.scrollTo({
        behavior: "smooth",
        top: ul.scrollHeight
    })

})