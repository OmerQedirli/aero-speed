// --- CONFIGURATION ---
const supabaseUrl = 'https://vyomenztedpzdjpfstoi.supabase.co';
const supabaseKey = 'sb_publishable_txGEFfRwnwkk8dDN5dFBrQ_jG77uDl9'; // <--- Öz Anon Keyini bura yaz
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

const Web3Modal = window.Web3Modal.default;
const WalletConnectProvider = window.WalletConnectProvider.default;

let userWallet = localStorage.getItem('userWallet');
let balance = 0;
let miningPower = 10000;
let userName = "Pilot";
let web3Modal;

// --- WALLET ENGINE ---
function initWallet() {
    const providerOptions = {
        walletconnect: {
            package: WalletConnectProvider,
            options: { rpc: { 56: "https://bsc-dataseed.binance.org/" } }
        }
    };
    web3Modal = new Web3Modal({ cacheProvider: true, providerOptions, theme: "dark" });
}

async function connectWallet() {
    initWallet();
    try {
        const provider = await web3Modal.connect();
        const ethersProvider = new ethers.providers.Web3Provider(provider);
        const addr = await ethersProvider.getSigner().getAddress();
        userWallet = addr.toLowerCase();
        localStorage.setItem('userWallet', userWallet);
        document.getElementById('login-overlay').style.display = 'none';
        await loadUserData();
        startMining();
    } catch (e) { console.error("Login Cancelled"); }
}

// --- DATA ENGINE ---
async function loadUserData() {
    const { data, error } = await _supabase.from('users').select('*').eq('wallet', userWallet).maybeSingle();
    
    if (data) {
        let now = Math.floor(Date.now() / 1000);
        let diff = now - (data.last_seen || now);
        let offlineEarned = (parseFloat(data.mining_power) / 86400) * Math.min(diff, 86400);
        
        balance = parseFloat(data.balance) + offlineEarned;
        miningPower = data.mining_power || 10000;
        userName = data.username || "Pilot";
    } else {
        await _supabase.from('users').insert([{ wallet: userWallet, balance: 0, mining_power: 10000, last_seen: Math.floor(Date.now() / 1000) }]);
    }
    updateUI();
}

async function saveToCloud() {
    if(!userWallet) return;
    await _supabase.from('users').update({
        balance: balance,
        mining_power: miningPower,
        username: userName,
        last_seen: Math.floor(Date.now() / 1000)
    }).eq('wallet', userWallet);
}

// --- GAME LOGIC ---
function startMining() {
    setInterval(() => {
        balance += (miningPower / 86400);
        document.getElementById('balance-display').innerText = Math.floor(balance).toLocaleString();
    }, 1000);
    setInterval(saveToCloud, 20000); // 20 saniyədən bir buluda yaz
}

async function buyBoost(cost, power) {
    if (balance >= cost) {
        balance -= cost;
        miningPower += power;
        updateUI();
        await saveToCloud();
        alert("Boost Activated! 🚀");
    } else { alert("Insufficient AER!"); }
}

async function saveUsername() {
    const newName = document.getElementById('username-input').value;
    if(newName.length > 2) {
        userName = newName;
        updateUI();
        await saveToCloud();
        closeModal('profile-modal');
    }
}

async function openLeaderboardModal() {
    openModal('leader-modal');
    const { data } = await _supabase.from('users').select('username, balance').order('balance', { ascending: false }).limit(100);
    document.getElementById('leader-list').innerHTML = data.map((u, i) => `
        <div style="display:flex; justify-content:space-between; padding:12px; background:#000; border-radius:10px; margin-bottom:8px; border-left: 3px solid ${i<3?'var(--gold)':'#333'}">
            <span>#${i+1} ${u.username || 'Pilot'}</span>
            <span style="color:var(--gold); font-weight:bold;">${Math.floor(u.balance).toLocaleString()}</span>
        </div>
    `).join('');
}

// --- HELPERS ---
function updateUI() {
    document.getElementById('display-name').innerText = userName;
    document.getElementById('power-display').innerText = miningPower.toLocaleString();
    document.getElementById('wallet-address').innerText = userWallet;
}
function openModal(id) { document.getElementById(id).style.display = 'block'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function copyRef() { 
    const link = `https://${window.location.hostname}/?ref=${userWallet}`;
    navigator.clipboard.writeText(link);
    alert("Referral Link Copied!"); 
}

window.onload = () => { 
    if (userWallet) { 
        document.getElementById('login-overlay').style.display = 'none'; 
        loadUserData().then(startMining); 
    } 
};