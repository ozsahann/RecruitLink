/* scripts/events.js */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // LOGIN İŞLEMİ
    if (msg.type === "login") {
        const loginReqUrl = "https://testbackend.recruitcrafts.com/api/Security/LoginRequest";
        const userLoginUrl = "https://testbackend.recruitcrafts.com/api/Security/UserLogin";

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
                if (!tenantId) throw new Error("Tenant bilgisi alınamadı.");

                return fetch(userLoginUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ "Token": tempToken, "TenantId": tenantId })
                });
            } else {
                throw new Error(data.message || "Giriş başarısız.");
            }
        })
        .then(res => res.json())
        .then(finalData => {
            const finalToken = finalData.data?.token || finalData.data;
            if (finalData.success && finalToken) {
                chrome.storage.local.set({ "api_token": finalToken }, () => {
                    sendResponse({ success: true });
                });
            } else {
                sendResponse({ success: false, error: "Token alınamadı" });
            }
        })
        .catch(err => sendResponse({ success: false, error: err.message }));
        return true; 
    }

    // ADAYI SİSTEME AKTARMA
    if (msg.type === "downloadProfile") {
        chrome.storage.local.get(["api_token"], (result) => {
            fetch("https://testbackend.recruitcrafts.com/api/Candidate/Post", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + result.api_token
                },
                body: msg.content
            })
            .then(res => sendResponse({ success: res.ok }))
            .catch(err => sendResponse({ success: false, error: err.message }));
        });
        return true;
    }

    // POZİSYONLARI GETİR
    if (msg.type === "getPositions") {
        chrome.storage.local.get(["api_token"], (result) => {
            const myToken = result.api_token;
            if (!myToken) return sendResponse({ success: false });

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

// SİMGE TIKLANDIĞINDA PANELİ AÇ (Hata Korumalı)
chrome.action.onClicked.addListener((tab) => {
    if (tab.url?.includes("linkedin.com") || tab.url?.includes("github.com")) {
        chrome.tabs.sendMessage(tab.id, { todo: "toggle" }).catch(() => {
            console.log("Mesaj gönderilemedi, sayfa henüz hazır değil.");
        });
    }
});