const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const User = require('./models/User');
const Officer = require('./models/Officer');
const Application = require('./models/Application');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/municipal-app')
    .then(() => console.log('MongoDB Connected for Migration'))
    .catch(err => console.error('MongoDB Connection Error:', err));

const migrateUsers = async () => {
    const file = path.join(__dirname, 'users.json');
    if (!fs.existsSync(file)) return;
    const data = JSON.parse(fs.readFileSync(file));

    for (const u of data) {
        // ID generation or uniqueness check could be handled here if needed
        const exists = await User.findOne({ mobile: u.mobile });
        if (!exists) {
            await User.create(u);
            console.log(`Migrated user: ${u.name}`);
        }
    }
};

const migrateOfficers = async () => {
    const file = path.join(__dirname, 'officers.json');
    if (!fs.existsSync(file)) return;
    const data = JSON.parse(fs.readFileSync(file));

    for (const o of data) {
        const exists = await Officer.findOne({ username: o.username });
        if (!exists) {
            await Officer.create(o);
            console.log(`Migrated officer: ${o.username}`);
        }
    }
};

const migrateApplications = async () => {
    const file = path.join(__dirname, 'applications.json');
    if (!fs.existsSync(file)) return;
    const data = JSON.parse(fs.readFileSync(file));

    for (const app of data) {
        const exists = await Application.findOne({ applicationId: app.applicationId });
        if (!exists) {
            // Ensure date is a Date object
            if (app.date) app.date = new Date(app.date);

            // PATCH: Handle missing 'submittedBy' in legacy data
            if (!app.submittedBy) {
                app.submittedBy = app.data?.mobile || 'anonymous';
            }

            await Application.create(app);
            console.log(`Migrated app: ${app.applicationId}`);
        }
    }
};

const run = async () => {
    try {
        await migrateUsers();
        await migrateOfficers();
        await migrateApplications();
        console.log('Migration Completed Successfullly');
    } catch (e) {
        console.error('Migration Failed:', e);
    } finally {
        mongoose.disconnect();
    }
};

run();
