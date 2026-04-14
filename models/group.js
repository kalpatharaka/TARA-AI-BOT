const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    language: { type: String, default: 'en' }
});

module.exports = mongoose.model('Group', groupSchema);
