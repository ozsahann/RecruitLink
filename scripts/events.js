/* scripts/events.js */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    
    // LOGIN İŞLEMİ (Düzeltilmiş İki Aşamalı Akış)
    if (msg.type === "login") {
        const loginReqUrl = "https://testbackend.recruitcrafts.com/api/Security/LoginRequest";
        const userLoginUrl = "https://testbackend.recruitcrafts.com/api/Security/UserLogin";

        // AŞAMA 1: LoginRequest
        fetch(loginReqUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(msg.payload)
        })
        .then(res => res.json())
        .then(data => {
            if (data.success && data.data && data.data.token) {
                const tempToken = data.data.token;
                const tenantId = data.data.tenants[0]?.tenantId;

                if (!tenantId) throw new Error("Tenant (şirket) bilgisi alınamadı.");

                // AŞAMA 2: UserLogin - HATA BURADAYDI
                // Sunucu "Token" alanını BODY içinde bekliyor.
                return fetch(userLoginUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ 
                        "Token": tempToken,      // Hata mesajında istenen alan
                        "TenantId": tenantId      // Genellikle Token ile birlikte istenir
                    })
                });
            } else {
                throw new Error(data.message || "Giriş aşama 1 başarısız.");
            }
        })
        .then(res => res.json())
        .then(finalData => {
            // Nihai token'ı kaydediyoruz
            const finalToken = finalData.data?.token || finalData.data;
            if (finalData.success && finalToken) {
                chrome.storage.local.set({ "api_token": finalToken }, () => {
                    sendResponse({ success: true });
                });
            } else {
                sendResponse({ success: false, error: "Aşama 2 Hatası: " + (finalData.message || "Token alınamadı") });
            }
        })
        .catch(err => {
            console.error("Giriş Hatası:", err);
            sendResponse({ success: false, error: err.message });
        });
        return true; 
    }

    // ADAYI SİSTEME AKTARMA (POST)
    if (msg.type === "downloadProfile") {
        chrome.storage.local.get(["api_token"], (result) => {
            const myToken = result.api_token;
            if (!myToken) {
                sendResponse({ success: false, error: "Token bulunamadı" });
                return;
            }

            fetch("https://testbackend.recruitcrafts.com/api/Candidate/Post", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + myToken
                },
                body: msg.content
            })
            .then(res => {
                if(res.ok) {
                    sendResponse({ success: true });
                } else {
                    res.text().then(err => sendResponse({ success: false, error: err }));
                }
            })
            .catch(err => sendResponse({ success: false, error: err.message }));
        });
        return true;
    }

    // POZİSYONLARI GETİR
    if (msg.type === "getPositions") {
        chrome.storage.local.get(["api_token"], (result) => {
            const myToken = result.api_token;
            if (!myToken) {
                sendResponse({ success: false });
                return;
            }

            fetch("https://testbackend.recruitcrafts.com/api/CandidatePosition/Suggestion/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + myToken
                },
                body: JSON.stringify({
                    "pageSize": 100, "pageNumber": 1, "orderBy": "UpdateDate desc",
                    "includeProperties": "Candidate.Person.PersonExpertises.Expertise,Candidate.Person.PersonEducations,Candidate.Person.PersonExperiences,Candidate.CreateBy,CandidatePositionStatus,CompanyPosition.Company,CompanyPosition.CompanyPositionStatus,CreateBy,Candidate.CandidateTagAssignments",
                    "companyPositionId": null
                })
            })
            .then(res => res.json())
            .then(data => sendResponse({ success: true, data: data }))
            .catch(() => sendResponse({ success: false }));
        });
        return true;
    }
});

chrome.action.onClicked.addListener((tab) => {
    if (tab.url?.includes("linkedin.com")) {
        chrome.tabs.sendMessage(tab.id, { todo: "toggle" });
    }
});