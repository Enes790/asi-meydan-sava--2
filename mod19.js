// ===== YATAY KARAKTER SCROLL =====
(function () {
    const style = document.createElement('style');
    style.id = 'char-scroll-style';
    style.textContent = `
        .char-select-container {
            display: flex !important;
            flex-wrap: nowrap !important;
            justify-content: flex-start !important;
            gap: 10px !important;
            margin-bottom: 22px !important;
            max-width: 100% !important;
            width: 100% !important;
            padding: 8px 16px 16px 16px !important;
            overflow-x: auto !important;
            overflow-y: hidden !important;
            -webkit-overflow-scrolling: touch !important;
            touch-action: pan-x !important;
            scroll-snap-type: x mandatory !important;
            box-sizing: border-box !important;
        }
        .char-select-container::-webkit-scrollbar {
            height: 6px;
        }
        .char-select-container::-webkit-scrollbar-track {
            background: rgba(0,0,0,0.3);
            border-radius: 3px;
        }
        .char-select-container::-webkit-scrollbar-thumb {
            background: rgba(46,204,113,0.6);
            border-radius: 3px;
        }
        .char-card {
            flex: 0 0 auto !important;
            width: 80px !important;
            min-width: 80px !important;
            max-width: 80px !important;
            scroll-snap-align: start !important;
        }
        #start-screen {
            justify-content: flex-start !important;
            padding-top: 20px !important;
        }
    `;
    if (!document.getElementById('char-scroll-style')) {
        document.head.appendChild(style);
    }
})();