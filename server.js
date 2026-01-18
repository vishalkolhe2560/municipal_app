const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const mongoose = require('mongoose');

// Models
const User = require('./models/User');
const Officer = require('./models/Officer');
const Application = require('./models/Application');

const app = express();
const PORT = process.env.PORT || 3000;
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/municipal-app';

mongoose.connect(MONGODB_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.log(err));

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR);
}

// Multer Config
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOADS_DIR)
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname)
    }
});
const upload = multer({ storage: storage });

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname)); // Serve static files

// In-memory OTP storage
const otpStore = {};

// Routes

// Register Endpoint
app.post('/register', async (req, res) => {
    const { name, mobile, email, password } = req.body;

    if (!name || !mobile || !password) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    try {
        const existingUser = await User.findOne({ mobile });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }

        const newUser = await User.create({ name, mobile, email, password });
        console.log(`User registered: ${name} (${mobile})`);
        res.json({ success: true, message: 'Registration successful' });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// Helper: Generate Next Application ID
// With MongoDB, strictly sequential IDs are harder (concurrency), but needed for this app format.
// We will query for the latest ID of a specific type.
const generateNextApplicationId = async (prefix) => {
    // Find the latest application with this prefix
    // We can regex search or use a separate counter collection. 
    // For simplicity, we'll fetch the one with the highest ID string.

    // Sort by applicationId descending
    const lastApp = await Application.findOne({
        applicationId: { $regex: new RegExp(`^${prefix}-`) }
    }).sort({ applicationId: -1 });

    let nextId = 1;
    if (lastApp) {
        const parts = lastApp.applicationId.split('-');
        if (parts.length === 2) {
            const num = parseInt(parts[1], 10);
            if (!isNaN(num)) nextId = num + 1;
        }
    }

    const nextIdStr = nextId.toString().padStart(4, '0');
    return `${prefix}-${nextIdStr}`;
};

// Apply Birth Certificate
app.post('/apply-birth', upload.single('document'), async (req, res) => {
    try {
        const newAppId = await generateNextApplicationId('BIRTH');
        const newApp = await Application.create({
            applicationId: newAppId,
            type: 'BIRTH',
            data: req.body,
            file: req.file ? req.file.filename : null,
            submittedBy: req.body.mobile || 'anonymous'
        });
        console.log(`Birth Application received: ${newApp.applicationId}`);
        res.json({ success: true, applicationId: newApp.applicationId });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// Apply Death Certificate
app.post('/apply-death', upload.single('document'), async (req, res) => {
    try {
        const newAppId = await generateNextApplicationId('DEATH');
        const newApp = await Application.create({
            applicationId: newAppId,
            type: 'DEATH',
            data: req.body,
            file: req.file ? req.file.filename : null,
            submittedBy: req.body.mobile || 'anonymous'
        });
        console.log(`Death Application received: ${newApp.applicationId}`);
        res.json({ success: true, applicationId: newApp.applicationId });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// Lodge Grievance
app.post('/lodge-grievance', upload.single('document'), async (req, res) => {
    try {
        const newAppId = await generateNextApplicationId('GRV');
        const newApp = await Application.create({
            applicationId: newAppId,
            type: 'GRIEVANCE',
            data: req.body,
            file: req.file ? req.file.filename : null,
            submittedBy: req.body.mobile || 'anonymous'
        });
        console.log(`Grievance received: ${newApp.applicationId}`);
        res.json({ success: true, applicationId: newApp.applicationId });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// My Applications Endpoint
app.post('/my-applications', async (req, res) => {
    const { mobile } = req.body;
    if (!mobile) return res.json({ success: false, apps: [] });

    try {
        const myApps = await Application.find({ submittedBy: mobile }).sort({ _id: -1 }); // _id correlates with time
        res.json({ success: true, apps: myApps });
    } catch (e) {
        res.status(500).json({ success: false, apps: [] });
    }
});

// Track Application Endpoint
app.post('/track-application', async (req, res) => {
    const { applicationId } = req.body;
    try {
        const app = await Application.findOne({ applicationId });
        if (app) {
            res.json({ success: true, data: app });
        } else {
            res.status(404).json({ success: false, message: 'Application not found' });
        }
    } catch (e) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// Officer Login
app.post('/officer/login', async (req, res) => {
    const { username, password } = req.body;

    // Admin Check
    if (username === 'admin' && password === 'superadmin') {
        return res.json({ success: true, role: 'ADMIN' });
    }

    try {
        const officer = await Officer.findOne({ username, password });
        if (officer) {
            res.json({ success: true, role: 'OFFICER', user: officer });
        } else {
            res.status(401).json({ success: false, message: 'Invalid Credentials' });
        }
    } catch (e) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// Admin: Get Officers
app.get('/admin/officers', async (req, res) => {
    try {
        const officers = await Officer.find({});
        res.json({ success: true, officers });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// Admin: Add Officer
app.post('/admin/add-officer', async (req, res) => {
    const { username, password, name, rights, department } = req.body;

    try {
        const existing = await Officer.findOne({ username });
        if (existing) {
            return res.json({ success: false, message: 'Username already exists' });
        }

        await Officer.create({
            username,
            password,
            name,
            rights,
            department: department || null
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// Admin: Update Officer
app.post('/admin/update-officer', async (req, res) => {
    const { id, _id, password, name, rights, department } = req.body;
    // Client might send numeric id (old) or _id (new). Handle both if needed, but preferably _id.
    // Since migration kept `id` field, we can lookup by that IF passed, otherwise _id.

    const query = _id ? { _id } : { id: parseInt(id) };

    try {
        const updateData = {};
        if (password) updateData.password = password;
        if (name) updateData.name = name;
        if (rights) updateData.rights = rights;
        if (department !== undefined) updateData.department = department;

        const updated = await Officer.findOneAndUpdate(query, updateData, { new: true });
        if (updated) {
            res.json({ success: true });
        } else {
            res.json({ success: false, message: 'Officer not found' });
        }
    } catch (e) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// Admin: Delete Officer
app.post('/admin/delete-officer', async (req, res) => {
    const { id, _id } = req.body;
    const query = _id ? { _id } : { id: parseInt(id) };

    try {
        await Officer.deleteOne(query);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// Admin: Get Departments (Derived from Officers)
app.get('/departments', async (req, res) => {
    try {
        // Find officers with GRIEVANCE right and a department
        const officers = await Officer.find({
            rights: 'GRIEVANCE',
            department: { $exists: true, $ne: null }
        });

        const depts = new Set();
        officers.forEach(o => {
            if (o.department) depts.add(o.department);
        });

        const deptList = Array.from(depts).map((name, i) => ({ id: i, name }));
        res.json({ success: true, departments: deptList });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// Get All Applications (Officer) - Filtered by Rights
app.post('/officer/applications', async (req, res) => {
    const { username } = req.body;

    try {
        const officer = await Officer.findOne({ username });

        if (username) {
            if (officer) {
                const rights = officer.rights || [];

                // Base filter: Application type must be in rights
                let query = { type: { $in: rights } };

                // Fetch to filter further in memory OR construct complex query
                // It's easier to fetch all matching types then filter by department in code 
                // matched to the detailed logic in the original file.

                const apps = await Application.find(query).sort({ _id: -1 });

                // Filter by Department (If officer has department AND app is GRIEVANCE)
                let filteredApps = apps;
                if (officer.department) {
                    console.log(`Filtering for Department: ${officer.department}`);
                    filteredApps = apps.filter(a => {
                        if (a.type === 'GRIEVANCE') {
                            const appDept = a.data?.department?.toLowerCase().trim();
                            const officerDept = officer.department.toLowerCase().trim();

                            const match = appDept === officerDept ||
                                appDept === officerDept + 's' ||
                                officerDept === appDept + 's';
                            return match;
                        }
                        return true;
                    });
                }

                console.log(`Officer ${username} fetching apps. Found ${filteredApps.length} matches.`);
                res.json({ success: true, apps: filteredApps });

            } else {
                // Admin view
                if (username === 'admin') {
                    const apps = await Application.find({}).sort({ _id: -1 });
                    res.json({ success: true, apps });
                } else {
                    res.json({ success: false, message: 'Officer not found' });
                }
            }
        } else {
            // Fallback
            const apps = await Application.find({}).sort({ _id: -1 });
            res.json({ success: true, apps });
        }
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// Update Application Status (Officer)
app.post('/officer/update-status', upload.single('certificate'), async (req, res) => {
    const { applicationId, status, remark } = req.body;

    try {
        const updateData = { status, remark: remark || null };
        if (req.file) {
            updateData.certificateFile = req.file.filename;
        }

        const app = await Application.findOneAndUpdate(
            { applicationId },
            updateData,
            { new: true }
        );

        if (app) {
            res.json({ success: true });
        } else {
            res.status(404).json({ success: false, message: 'Application not found' });
        }
    } catch (e) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// Citizen Reply to Clarification
app.post('/reply-clarification', upload.single('clarificationDoc'), async (req, res) => {
    const { applicationId, opinion } = req.body;

    try {
        const updateData = {
            status: 'CLARIFICATION_SUBMITTED',
            clarificationReply: {
                opinion: opinion,
                file: req.file ? req.file.filename : null,
                date: new Date().toISOString()
            }
        };

        const app = await Application.findOneAndUpdate(
            { applicationId },
            updateData,
            { new: true }
        );

        if (app) {
            res.json({ success: true });
        } else {
            res.status(404).json({ success: false, message: 'Application not found' });
        }
    } catch (e) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// Officer: Forward Grievance
app.post('/officer/forward-grievance', async (req, res) => {
    const { applicationId, targetDepartment, remark, fromOfficerUsername } = req.body;

    try {
        const app = await Application.findOne({ applicationId });
        const fromOfficer = await Officer.findOne({ username: fromOfficerUsername });

        if (app) {
            const transferRecord = {
                from: fromOfficer ? fromOfficer.name : fromOfficerUsername,
                fromDept: app.data.department,
                toDept: targetDepartment,
                date: new Date().toISOString(),
                remark: remark
            };

            // Update app
            app.transferHistory.push(transferRecord);
            app.data.department = targetDepartment; // Main update

            // We need to mark 'data' as modified because it is a Mixed type
            app.markModified('data');

            app.status = 'PENDING';
            app.remark = null;

            await app.save();
            res.json({ success: true });
        } else {
            res.status(404).json({ success: false, message: 'Application not found' });
        }
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// Download Endpoint
app.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(UPLOADS_DIR, filename);
    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).send('File not found');
    }
});

// Login Endpoint
app.post('/login', async (req, res) => {
    const { mobile, password } = req.body;

    try {
        const user = await User.findOne({ mobile, password });
        if (user) {
            console.log(`User logged in: ${user.name}`);
            res.json({ success: true, message: 'Login successful', user: { name: user.name, mobile: user.mobile } });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    } catch (e) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// Forgot Password - Send OTP
app.post('/send-otp', async (req, res) => {
    const { mobile } = req.body;
    try {
        const user = await User.findOne({ mobile });
        if (user) {
            const otp = Math.floor(1000 + Math.random() * 9000).toString();
            otpStore[mobile] = otp;
            console.log(`OTP for ${mobile}: ${otp}`);
            res.json({ success: true, message: 'OTP sent successfully', otp });
        } else {
            res.status(404).json({ success: false, message: 'User not found' });
        }
    } catch (e) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// Forgot Password - Reset Password
app.post('/reset-password', async (req, res) => {
    const { mobile, otp, newPassword } = req.body;

    if (otpStore[mobile] === otp) {
        try {
            const user = await User.findOne({ mobile });
            if (user) {
                user.password = newPassword;
                await user.save();
                delete otpStore[mobile];
                res.json({ success: true, message: 'Password reset successful' });
            } else {
                res.status(404).json({ success: false, message: 'User not found' });
            }
        } catch (e) {
            res.status(500).json({ success: false, message: 'Server Error' });
        }
    } else {
        res.status(400).json({ success: false, message: 'Invalid OTP' });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
