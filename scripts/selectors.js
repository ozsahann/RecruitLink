// scripts/selectors.js
window.selectors = {
    linkedin: {
        basicProfile: {
            name: "h1",
            headline: "div.text-body-medium.break-words",
            location: "span.text-body-small.inline.t-black--light.break-words",
            about: "section[data-view-name='profile-card'] div.inline-show-more-text--is-collapsed > span[aria-hidden='true']",
            photo_url: "div.pv-top-card__non-self-photo-wrapper img"
        },
        experience: {
            jobTitle: "div.t-bold span[aria-hidden='true']",
            companyAndType: "span.t-14.t-normal > span[aria-hidden='true']",
            duration: "span.pvs-entity__caption-wrapper[aria-hidden='true']"
        }
    },
    github: {
        basicProfile: {
            // Virgül ile ayrılmış seçiciler: Bulabildiği ilkini alır
            name: "span.p-name, h1.vcard-names span", 
            nickname: "span.p-nickname, .vcard-username",
            headline: "div.p-note.user-profile-bio, .p-note", 
            location: "span.p-label, li[itemprop='homeLocation'] span",
            about: "div.p-note.user-profile-bio",
            photo_url: "img.avatar-user"
        }
    }
};