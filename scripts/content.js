/* scripts/content.js */

let allPositions = [];
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// SLIDER AÇMA KAPAMA DİNLEYİCİSİ
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.todo === "toggle") {
        const slider = document.getElementById("yale3_slider");
        if (slider) {
            const currentWidth = window.getComputedStyle(slider).width;
            slider.style.width = (currentWidth === "0px" || slider.style.width === "0px") ? "450px" : "0px";
            // Her açıldığında oturumu kontrol et
            if (slider.style.width === "450px") checkAuthAndRender();
        }
    }
});

async function checkAuthAndRender() {
    chrome.storage.local.get(["api_token"], (result) => {
        const loginView = document.getElementById("login_view");
        const mainView = document.getElementById("main_view");
        
        if (result.api_token) {
            if(loginView) loginView.style.display = "none";
            if(mainView) mainView.style.display = "block";
            setTimeout(refreshSliderData, 500);
        } else {
            if(loginView) loginView.style.display = "block";
            if(mainView) mainView.style.display = "none";
        }
    });
}

function initEventListeners() {
    // Login Butonu
    const loginBtn = document.getElementById("do_login_button");
    if (loginBtn) {
        loginBtn.onclick = () => {
            const userInput = document.getElementById("login_email").value;
            const passInput = document.getElementById("login_password").value;
            const errorLabel = document.getElementById("login_error");

            loginBtn.innerText = "⏳...";
            chrome.runtime.sendMessage({
                type: "login",
                payload: { userInfo: userInput, password: passInput }
            }, (response) => {
                if (response && response.success) {
                    checkAuthAndRender();
                } else {
                    errorLabel.innerText = response?.error || "Hata!";
                    errorLabel.style.display = "block";
                    loginBtn.innerText = "Giriş Yap";
                }
            });
        };
    }

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

    document.getElementById("logout_button")?.addEventListener("click", () => {
        chrome.storage.local.remove("api_token", () => checkAuthAndRender());
    });

    document.getElementById("refresh_profile_data_button")?.addEventListener("click", refreshSliderData);
    document.getElementById("save_profile_data_button")?.addEventListener("click", handleSaveAction);
}

async function refreshSliderData() {
    const basic = getBasicProfileSection();
    const exp = getExperienceSection();
    const nameTitle = document.getElementById("name_title");
    if(nameTitle) nameTitle.textContent = basic.name || "Aday Bekleniyor...";
    
    injectDataintoTextArea("basicprofile", basic);
    injectDataintoTextArea("experiencetext", exp);
    loadPositionsIntoDropdown();
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
    btn.innerText = "⏳ Aktarılıyor...";
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
        if (response && response.success) {
            btn.innerText = "✅ Kaydedildi";
        } else {
            btn.innerText = "❌ Hata!";
        }
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
    return Array.from(expNode.querySelectorAll('li.artdeco-list__item')).map(li => ({
        jobTitle: li.querySelector(".t-bold span[aria-hidden='true']")?.textContent.trim() || ""
    }));
}

function injectDataintoTextArea(id, data) {
    const el = document.getElementById(id);
    if (el) el.value = typeof data === 'object' ? JSON.stringify(data, null, 2) : data;
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