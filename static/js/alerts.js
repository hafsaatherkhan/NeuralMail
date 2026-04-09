/**
 * NeuralMail Global Alert Handler v1.2
 * Auto-detects context (Success/Error/Info) and overrides window.alert
 */

(function() {
    // 1. Inject Professional Styles
    const style = document.createElement('style');
    style.textContent = `
        #nm-global-alert {
            position: fixed;
            top: 25px;
            left: 50%;
            transform: translateX(-50%) translateY(-20px);
            z-index: 10000;
            opacity: 0;
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            pointer-events: none;
        }
        #nm-global-alert.active {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
        .nm-alert-box {
            background: rgba(11, 14, 20, 0.9);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(199, 153, 255, 0.2);
            padding: 12px 28px;
            border-radius: 99px;
            display: flex;
            align-items: center;
            gap: 12px;
            box-shadow: 0 15px 35px rgba(0,0,0,0.5), 0 0 15px rgba(199, 153, 255, 0.05);
        }
        .nm-alert-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            transition: all 0.3s ease;
        }
        .nm-alert-msg {
            color: #ecedf6;
            font-size: 13.5px;
            font-weight: 500;
            font-family: 'Space Grotesk', sans-serif;
            letter-spacing: -0.01em;
        }
        /* State Colors */
        .dot-purple { background: #c799ff; box-shadow: 0 0 12px #c799ff; }
        .dot-red    { background: #ff5555; box-shadow: 0 0 12px #ff5555; }
        .dot-green  { background: #4af8e3; box-shadow: 0 0 12px #4af8e3; }
        
        .border-red   { border-color: rgba(255, 85, 85, 0.3); }
        .border-green { border-color: rgba(74, 248, 227, 0.3); }
    `;
    document.head.appendChild(style);

    // 2. Overwrite Native Alert
    window.alert = function(message) {
        let wrapper = document.getElementById('nm-global-alert');
        
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.id = 'nm-global-alert';
            wrapper.innerHTML = `
                <div id="nm-alert-card" class="nm-alert-box">
                    <div id="nm-alert-dot" class="nm-alert-dot"></div>
                    <span id="nm-alert-content" class="nm-alert-msg"></span>
                </div>
            `;
            document.body.appendChild(wrapper);
        }

        const card = document.getElementById('nm-alert-card');
        const dot = document.getElementById('nm-alert-dot');
        const content = document.getElementById('nm-alert-content');
        const msg = message.toLowerCase();

        // Reset classes
        dot.className = 'nm-alert-dot';
        card.className = 'nm-alert-box';

        // 3. Smart Context Detection
        if (msg.includes('error') || msg.includes('invalid') || msg.includes('wrong') || msg.includes('failed')) {
            dot.classList.add('dot-red');
            card.classList.add('border-red');
        } else if (msg.includes('success') || msg.includes('done') || msg.includes('saved') || msg.includes('sent')) {
            dot.classList.add('dot-green');
            card.classList.add('border-green');
        } else {
            dot.classList.add('dot-purple');
        }

        content.innerText = message;
        
        // Show with slight delay for smooth transition if called multiple times
        setTimeout(() => wrapper.classList.add('active'), 10);

        // Auto-Hide after 3.5 seconds
        setTimeout(() => {
            wrapper.classList.remove('active');
        }, 3500);
    };
})();