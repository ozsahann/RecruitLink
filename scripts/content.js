/* scripts/content.js */

let allPositions = [];
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// SLIDER AÇMA KAPAMA
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.todo === "toggle") {
        const slider = document.getElementById("yale3_slider");
        if (slider) {
            const currentWidth = window.getComputedStyle(slider).width;
            slider.style.width = (currentWidth === "0px" || slider.style.width === "0px") ? "450px" : "0px";
            if (slider.style.width === "450px") checkAuthAndRender();
        }
    }
});

// OTURUM KONTROLÜ VE EKRAN GEÇİŞİ
async function checkAuthAndRender() {
    chrome.storage.local.get(["api_token"], (result) => {
        const loginView = document.getElementById("login_view");
        const mainView = document.getElementById("main_view");
        
        if (result.api_token) {
            if(loginView) loginView.style.setProperty('display', 'none', 'important');
            if(mainView) mainView.style.setProperty('display', 'flex', 'important');
            refreshSliderData(); 
        } else {
            if(loginView) loginView.style.setProperty('display', 'block', 'important');
            if(mainView) mainView.style.setProperty('display', 'none', 'important');
            clearSliderFields(); 
        }
    });
}

// VERİLERİ VE GİRİŞ DURUMUNU TEMİZLEME
function clearSliderFields() {
    // Aday Bilgilerini Temizle
    const nameTitle = document.getElementById("name_title");
    if(nameTitle) nameTitle.textContent = "Aday Bekleniyor...";
    
    injectDataintoTextArea("basicprofile", "");
    injectDataintoTextArea("experiencetext", "");
    
    const select = document.getElementById("position_select");
    if (select) select.innerHTML = "<option value=''>Yükleniyor...</option>";

    // ✅ Giriş Formunu Düzenle
    const passwordInput = document.getElementById("login_password");
    if (passwordInput) passwordInput.value = ""; // Şifreyi sil

    const loginBtn = document.getElementById("do_login_button");
    if (loginBtn) loginBtn.innerText = "Giriş Yap"; // Kum saatini kaldır
}

// OKUNABİLİR METİN FORMATI
function simplifyText(data, type) {
    if (!data) return "";
    if (type === 'basic') {
        return `İsim: ${data.name || '-'}\nUnvan: ${data.headline || '-'}\nKonum: ${data.location || '-'}\nHakkında: ${data.about || '-'}`;
    }
    if (type === 'experience' && Array.isArray(data)) {
        return data.map(exp => `- ${exp.jobTitle}${exp.company ? ' (' + exp.company + ')' : ''}`).join('\n');
    }
    return "";
}

// VERİLERİ YENİLEME
async function refreshSliderData() {
    chrome.storage.local.get(["api_token"], (result) => {
        if (!result.api_token) return;

        const basic = getBasicProfileSection();
        const exp = getExperienceSection();
        const nameTitle = document.getElementById("name_title");
        
        if(nameTitle) nameTitle.textContent = basic.name || "Aday Bekleniyor...";
        
        injectDataintoTextArea("basicprofile", simplifyText(basic, 'basic'));
        injectDataintoTextArea("experiencetext", simplifyText(exp, 'experience'));
        
        loadPositionsIntoDropdown();
    });
}

function initEventListeners() {
    // Login İşlemi
    document.getElementById("do_login_button")?.addEventListener("click", () => {
        const userInput = document.getElementById("login_email").value;
        const passInput = document.getElementById("login_password").value;
        const btn = document.getElementById("do_login_button");

        btn.innerText = "⏳...";
        chrome.runtime.sendMessage({
            type: "login",
            payload: { userInfo: userInput, password: passInput }
        }, (response) => {
            if (response && response.success) {
                checkAuthAndRender();
            } else {
                alert("Hata: " + (response?.error || "Giriş yapılamadı"));
                btn.innerText = "Giriş Yap";
            }
        });
    });

    // Logout İşlemi
    document.getElementById("logout_button")?.addEventListener("click", () => {
        chrome.storage.local.remove("api_token", () => checkAuthAndRender());
    });

    // Arama Kutusu
    const searchInput = document.getElementById("position_search");
    if (searchInput) {
        searchInput.oninput = (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = allPositions.filter(item => {
                const pos = item.companyPosition || item;
                const name = (pos.name || pos.title || "").toLowerCase();
                return name.includes(term);
            });
            renderPositions(filtered);
        };
    }

    document.getElementById("refresh_profile_data_button")?.addEventListener("click", refreshSliderData);
    document.getElementById("save_profile_data_button")?.addEventListener("click", handleSaveAction);
}

function loadPositionsIntoDropdown() {
    const select = document.getElementById("position_select");
    if (!select) return;
    chrome.runtime.sendMessage({ type: "getPositions" }, (response) => {
        if (response && response.success) {
            allPositions = response.data?.data || [];
            renderPositions(allPositions);
        } else {
            select.innerHTML = "<option>Yüklenemedi</option>";
        }
    });
}

function renderPositions(list) {
    const select = document.getElementById("position_select");
    if (!select) return;
    select.innerHTML = "";
    if (list.length === 0) {
        select.innerHTML = "<option value=''>Sonuç bulunamadı</option>";
        return;
    }
    list.forEach(item => {
        const pos = item.companyPosition || item;
        if (pos && pos.id) {
            const opt = document.createElement("option");
            opt.value = pos.id;
            opt.textContent = `${pos.name || pos.title}#${pos.id}`;
            select.appendChild(opt);
        }
    });
}

async function handleSaveAction() {
    const btn = document.getElementById("save_profile_data_button");
    btn.innerText = "⏳...";
    btn.disabled = true;
    
    const basic = getBasicProfileSection();
    const contact = await scrapeContactInfoModal();
    const posId = document.getElementById("position_select")?.value;

    const payload = {
        "Name": basic.name?.split(" ")[0] || "",
        "Family": basic.name?.split(" ").pop() || "",
        "Email": contact.email || window.location.href,
        "LinkedinUrl": window.location.href.split('/overlay/')[0],
        "Description": (basic.about || basic.headline || ""),
        "CompanyPositionId": posId ? parseInt(posId) : 724
    };

    chrome.runtime.sendMessage({ type: "downloadProfile", content: JSON.stringify(payload) }, (response) => {
        btn.disabled = false;
        btn.innerText = response?.success ? "✅ Kaydedildi" : "❌ Hata";
        setTimeout(() => { btn.innerText = "Sisteme Kaydet"; }, 2000);
    });
}

function getBasicProfileSection() {
    const data = {};
    const selectors = window.selectors?.basicProfile || {};
    for(const key in selectors) {
        const el = document.querySelector(selectors[key]);
        data[key] = el?.tagName === "IMG" ? el.src : el?.textContent.trim() || "";
    }
    return data;
}

function getExperienceSection() {
    const sections = document.querySelectorAll("section[data-view-name='profile-card']");
    const expNode = Array.from(sections).find(sec => sec.querySelector('#experience')) || null;
    if (!expNode) return [];

    return Array.from(expNode.querySelectorAll('li.artdeco-list__item')).map(li => {
        const title = li.querySelector(".t-bold span[aria-hidden='true']")?.textContent.trim() || "";
        const company = li.querySelector(".t-14.t-normal span[aria-hidden='true']")?.textContent.trim() || "";
        return { jobTitle: title, company: company.split(' · ')[0] };
    }).filter(item => item.jobTitle !== "");
}

function injectDataintoTextArea(id, data) {
    const el = document.getElementById(id);
    if (el) el.value = data;
}

async function scrapeContactInfoModal() {
    let email = null;
    try {
        const link = document.getElementById('top-card-text-details-contact-info');
        if (link) {
            link.click();
            await wait(1000); 
            email = document.querySelector('a[href^="mailto:"]')?.textContent.trim();
            document.querySelector('button[aria-label="Dismiss"]')?.click();
        }
    } catch(e) {}
    return { email };
}

function loadSlider() {
    if (document.getElementById("yale3_slider")) return;
    const sliderContainer = document.createElement("div");
    sliderContainer.id = "yale3_slider";
    fetch(chrome.runtime.getURL("views/slider.html"))
        .then(res => res.text())
        .then(html => {
            sliderContainer.innerHTML = html;
            document.body.prepend(sliderContainer);
            initEventListeners();
            checkAuthAndRender();
        });
}

loadSlider();