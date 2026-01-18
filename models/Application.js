const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
    applicationId: { type: String, required: true, unique: true },
    type: { type: String, required: true, enum: ['BIRTH', 'DEATH', 'GRIEVANCE'] },

    // Flexible data field to store form inputs which vary by application type
    data: { type: mongoose.Schema.Types.Mixed },

    file: { type: String }, // Uploaded document filename
    status: { type: String, default: 'PENDING' },
    date: { type: Date, default: Date.now },
    submittedBy: { type: String, required: true }, // Mobile number of citizen

    // Officer/System updates
    remark: { type: String },
    certificateFile: { type: String }, // Generated certificate

    // For transfers
    transferHistory: [{
        from: String,
        fromDept: String,
        toDept: String,
        date: Date,
        remark: String
    }],

    // For clarifications
    clarificationReply: {
        opinion: String,
        file: String,
        date: Date
    }
});

module.exports = mongoose.model('Application', applicationSchema);
