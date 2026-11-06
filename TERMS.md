# Terms of Use & Legal Disclaimers

**Effective Date:** November 6, 2026

By downloading, installing, or running **AntiPersonality**, you agree to these Terms of Use and the accompanying [MIT License](./LICENSE).

## 1. Free & Open-Source Software (No Commercial Charges or Refunds)

AntiPersonality is distributed free of charge (`$0`) as open-source software under the [MIT License](./LICENSE). This repository does not process payments, sell subscriptions, or operate an e-commerce storefront; accordingly, commercial refund or billing policies do not apply.

## 2. Unofficial Client Modification & Assumption of Risk

AntiPersonality modifies the local presentation layer of **Google Antigravity Desktop** by connecting to your own local Electron instance over the loopback Chrome DevTools Protocol (`127.0.0.1`) and injecting client-side CSS and JavaScript.

- **Use at Your Own Risk:** Client modifications may break when upstream Antigravity updates change internal DOM structures or CSS tokens. As stated in the [MIT License](./LICENSE), the software is provided **"AS IS", without warranty of any kind**.
- **Upstream Terms Compliance:** You are solely responsible for ensuring that your use of local DevTools/client customization complies with Google Antigravity's applicable Terms of Service and any organizational policies governing your workstation.
- **Clean Reversibility:** You can revert all injected styles and runtime modifications at any time via `injector.js reset` or the **Reset to Stock** / **Purge Data** controls.

## 3. Non-Affiliation & Trademark Disclaimer

**AntiPersonality** is an independent, community-developed open-source project.

- It is **not affiliated with, endorsed by, sponsored by, or officially connected to Google LLC** (or Google Antigravity).
- Built-in `.theme.css` files in `themes/` contain **original CSS color-token mappings and procedural SVG/CSS effects only**. Zero third-party copyrighted images, character sprites, audio files, or video wallpapers are distributed in this repository.
- Theme names or palette descriptions referencing third-party creative works (such as *Wuthering Waves* / Kuro Games or *Library of Ruina* / Project Moon) are strictly **unofficial, transformative fan-inspired color schemes** used for descriptive reference only. All product names, logos, and brands remain the property of their respective owners.

## 4. User-Supplied Custom CSS & External Media

If you load custom CSS rules, fonts, images, or external theme scripts from your local machine, you are solely responsible for ensuring you hold the necessary rights or licenses to use those assets locally and that you do not redistribute copyrighted third-party media without permission.
