/* scripts/content.js */

let allPositions = [];

function getCurrentSite() {
    return window.location.hostname.includes("github.com") ? "github" : "linkedin";
}

// SLIDER AÇMA/KAPAMA
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
        }
    });
}

// DENEYİM VERİLERİNİ ÇEKEN FONKSİYON (ESKİ HALİNE GETİRİLDİ)
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

function getBasicProfileSection(site) {
    const data = {};
    const siteConfig = window.selectors[site] || window.selectors.linkedin;
    const selectors = siteConfig.basicProfile || {};

    for(const key in selectors) {
        const el = document.querySelector(selectors[key]);
        data[key] = el ? (el.tagName === "IMG" ? el.src : el.textContent.trim()) : "";
    }
    if (site === "github" && !data.name) data.name = data.nickname;
    return data;
}

// VERİLERİ FORMATLAYAN FONKSİYON (ESKİ HALİNE GETİRİLDİ)
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

async function refreshSliderData() {
    const site = getCurrentSite();
    const basic = getBasicProfileSection(site);
    
    // LinkedIn ise deneyimleri çek, GitHub ise boş bırak
    const exp = (site === "linkedin") ? getExperienceSection() : [];
    
    const nameTitle = document.getElementById("name_title");
    if(nameTitle) nameTitle.textContent = basic.name || "Aday Bekleniyor...";
    
    // Form alanlarını doldur
    injectDataintoTextArea("basicprofile", simplifyText(basic, 'basic'));
    injectDataintoTextArea("experiencetext", simplifyText(exp, 'experience'));
    
    loadPositionsIntoDropdown();
}

function loadPositionsIntoDropdown() {
    const select = document.getElementById("position_select");
    if (!select) return;
    chrome.runtime.sendMessage({ type: "getPositions" }, (response) => {
        if (response && response.success) {
            allPositions = response.data?.data || [];
            renderPositions(allPositions);
        }
    });
}

function renderPositions(list) {
    const select = document.getElementById("position_select");
    if (!select) return;
    select.innerHTML = "";
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
    const site = getCurrentSite();
    const basic = getBasicProfileSection(site);
    
    btn.innerText = "⏳...";
    btn.disabled = true;

    let firstName = "Aday", lastName = "";
    if (basic.name) {
        const parts = basic.name.split(" ");
        lastName = parts.length > 1 ? parts.pop() : "";
        firstName = parts.join(" ");
    }

    const payload = {
        "Name": firstName,
        "Family": lastName,
        "Email": window.location.href,
        "LinkedinUrl": window.location.href,
        "Description": (basic.about || basic.headline || ""),
        "CompanyPositionId": parseInt(document.getElementById("position_select")?.value || 724)
    };

    chrome.runtime.sendMessage({ type: "downloadProfile", content: JSON.stringify(payload) }, (res) => {
        btn.disabled = false;
        btn.innerText = res?.success ? "✅ Kaydedildi" : "❌ Hata";
        setTimeout(() => { btn.innerText = "Sisteme Kaydet"; }, 2000);
    });
}

function initEventListeners() {
    document.getElementById("do_login_button")?.addEventListener("click", () => {
        const email = document.getElementById("login_email").value;
        const pass = document.getElementById("login_password").value;
        chrome.runtime.sendMessage({ type: "login", payload: { userInfo: email, password: pass } }, (res) => {
            if(res.success) checkAuthAndRender();
        });
    });

    document.getElementById("logout_button")?.addEventListener("click", () => {
        chrome.storage.local.remove("api_token", () => checkAuthAndRender());
    });

    // ARAMA KUTUSU
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

function injectDataintoTextArea(id, data) {
    const el = document.getElementById(id);
    if (el) el.value = data;
}

if (!document.getElementById("yale3_slider")) {
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