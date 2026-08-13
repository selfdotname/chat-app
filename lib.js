const crypto = require('crypto')

const encrypt = (text, secret) => {
    const iv = crypto.randomBytes(8)
    const cipher = crypto.createCipheriv('aes-256-gcm', secret, iv)
    const enc = cipher.update(text, 'utf-8', 'hex') + cipher.final('hex')
    const tag = cipher.getAuthTag()
    return `${iv.toString('hex')}:${tag.toString('hex')}:${enc}`
}
const decrypt = (token, secret) => {
    const [iv, tag, enc] = token.split(':')
    const decipher = crypto.createDecipheriv('aes-256-gcm', secret, Buffer.from(iv, 'hex'))
    decipher.setAuthTag(Buffer.from(tag, 'hex'))
    return decipher.update(enc, 'hex', 'utf-8') + decipher.final('utf-8')
}

module.exports = { encrypt, decrypt }