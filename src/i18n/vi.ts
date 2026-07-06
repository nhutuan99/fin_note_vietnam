export default {
  // ── Common ──
  common: {
    cancel: 'Hủy',
    confirm: 'Xác nhận',
    save: 'Lưu',
    update: 'Cập nhật',
    delete: 'Xóa',
    add: 'Thêm',
    edit: 'Sửa',
    close: 'Đóng',
    loading: 'Đang tải...',
    saving: 'Đang lưu...',
    today: 'Hôm nay',
    yesterday: 'Hôm qua',
    search: 'Tìm kiếm...',
    all: 'Tất cả',
    menu: 'MENU',
    preview: 'Xem trước',
    copyLink: 'Copy Link',
    export: 'Xuất dữ liệu',
    version: 'FinNote v1.0.1',
    copy: 'Copy',
    copied: 'Đã copy!',
    login: 'Đăng nhập',
    back: 'Quay lại',
    scrollToTop: 'Lên đầu trang',
    toggleTheme: 'Đổi giao diện',
    somethingWentWrong: 'Đã xảy ra lỗi',
    processing: 'Đang xử lý...',
    unsavedChanges: 'Chưa lưu',
    saved: 'Đã lưu {time}',
    tagsAdded: 'Đã thêm {n} tag',
    logout: 'Đăng xuất',
    shares: 'Cổ phiếu',
    currentPrice: 'Giá hiện tại',
    buyPrice: 'Giá mua',
    profit: 'Lãi/Lỗ',
    symbol: 'Mã CK',
    fundSymbol: 'Mã quỹ',
    quantity: 'Số lượng',
    target: 'Mục tiêu',
    stopLoss: 'Cắt lỗ',
    confirmDelete: 'Bạn có chắc chắn muốn xóa không?',
    noData: 'Chưa có dữ liệu',
    fillRequiredFields: 'Vui lòng điền đầy đủ thông tin bắt buộc',
    selectAll: 'Chọn tất cả',
    continue: 'Tiếp tục',
    goBack: 'Quay lại',
    apply: 'Xác nhận',
    copyLinkTitle: 'Sao chép liên kết',
    copiedTitle: 'Đã sao chép!',
    shareOnFacebook: 'Chia sẻ lên Facebook',
    shareOnTwitter: 'Chia sẻ lên Twitter',
    shareOnLinkedIn: 'Chia sẻ lên LinkedIn'
  },

  // ── Stock Alerts ──
  stockAlert: {
    addAlert: 'Đặt mốc giá',
    direction: 'Loại cảnh báo',
    targetPrice: 'Giá mục tiêu (x1000)',
    buy: 'Mua (giá xuống)',
    sell: 'Bán (giá lên)',
    label: 'Ghi chú',
    optional: 'không bắt buộc',
    buyPlaceholder: 'Canh mua khi giá hồi',
    sellPlaceholder: 'Chốt lời khi đạt mốc',
    triggered: 'Đã chạm mốc!',
    added: 'Đã thêm mốc giá thành công',
    reset: 'Đặt lại',
    resetDone: 'Đã đặt lại mốc giá',
    delete: 'Xóa mốc',
    noAlerts: 'Chưa có mốc giá',
    stopLoss: 'Cắt lỗ',
    takeProfit: 'Mục tiêu chốt lời'
  },

  // ── Stocks / Funds View ──
  stocks: {
    tabStocks: 'Cổ phiếu',
    tabFunds: 'Chứng chỉ quỹ',
    // Chart tooltip
    tooltipOpen: 'Mở cửa:',
    tooltipHigh: 'Cao nhất:',
    tooltipLow: 'Thấp nhất:',
    tooltipClose: 'Kết phiên:',
    tooltipVolume: 'Khối lượng:',
    // Company info tooltip
    loadingInfo: 'Đang tải thông tin...',
    listedCode: 'Mã niêm yết:',
    exchange: 'Sàn GDKC:',
    listedDate: 'Ngày niêm yết:',
    intlName: 'Tên QT:',
    // Price bar titles
    buyPriceLabel: 'Giá mua:',
    currentPriceLabel: 'Giá hiện tại:',
    // Toast messages
    updated: 'Đã cập nhật mã {symbol}',
    added: 'Đã thêm mã {symbol}',
    deleted: 'Đã xóa mã {symbol}',
    // PIN confirm
    pinTitle: 'Xác nhận mã PIN',
    pinMessage: 'Nhập mã PIN để xóa mã {symbol}',
    // Confirm dialogs
    deleteStockTitle: 'Xóa mã chứng khoán'
  },

  // ── Funds View ──
  funds: {
    title: 'Chứng chỉ quỹ',
    totalNav: 'Tổng NAV',
    addFund: 'Thêm quỹ',
    empty: 'Chưa có chứng chỉ quỹ nào',
    emptyHint: 'Thêm quỹ để theo dõi NAV & lợi nhuận',
    currentNav: 'NAV hiện tại',
    buyPricePerUnit: 'Giá mua / CCQ',
    profit: 'Lợi nhuận',
    portfolioValue: 'Giá trị danh mục',
    unitCount: '{count} CCQ',
    // Fund type labels
    typeStock: 'Cổ phiếu',
    typeBond: 'Trái phiếu',
    typeBalance: 'Cân bằng',
    // Confirm & toast
    deleteFundTitle: 'Xoá chứng chỉ quỹ',
    deleteFundMessage: 'Bạn có chắc muốn xoá {symbol} khỏi danh mục?',
    deleteFundConfirm: 'Xoá',
    fundUpdated: 'Đã cập nhật {symbol}',
    fundAdded: 'Đã thêm {symbol}',
    fundDeleted: 'Đã xoá {symbol}'
  },

  // ── Time ──
  time: {
    justNow: 'Vừa xong',
    minutesAgo: '{n} phút trước',
    hoursAgo: '{n} giờ trước',
    daysAgo: '{n} ngày trước',
    mAgo: '{n}m trước',
    hAgo: '{n}h trước',
    dAgo: '{n}d trước'
  },

  // ── Days ──
  days: {
    short: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'],
    long: ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']
  },

  // ── Months ──
  months: [
    'Tháng 1',
    'Tháng 2',
    'Tháng 3',
    'Tháng 4',
    'Tháng 5',
    'Tháng 6',
    'Tháng 7',
    'Tháng 8',
    'Tháng 9',
    'Tháng 10',
    'Tháng 11',
    'Tháng 12'
  ],

  // ── Navigation ──
  nav: {
    dashboard: 'Dashboard',
    transactions: 'Giao dịch',
    wallets: 'Tài khoản',
    stocks: 'Chứng khoán',
    notes: 'Ghi chú',
    blog: 'Blog',
    settings: 'Cài đặt',
    success: 'Thành công',
    error: 'Lỗi',
    warning: 'Cảnh báo',
    workspace: 'Công việc',
    system: 'Hệ thống',
    addTransaction: 'Thêm giao dịch',
    walletSection: 'VÍ',
    totalBalance: 'Tổng ví',
    autoSync: 'Đồng bộ tự động',
    recentNotes: 'Ghi chú gần đây',
    recurring: 'Định kỳ',
    budget: 'Ngân sách',
    savings: 'Tiết kiệm',
    subscriptions: 'Đăng ký dịch vụ',
    planning: 'Kế hoạch tài chính',
    trading: 'Trading Journal'
  },

  // ── Trading Journal ──
  trading: {
    // Page
    title: 'Trading Journal',
    subtitle: 'Theo dõi lãi/lỗ theo ngày · Phân tích hiệu suất',
    checkinToday: 'Check-in hôm nay',
    editCheckinToday: 'Sửa check-in hôm nay',

    // Period tabs
    day: 'Ngày',
    month: 'Tháng',
    year: 'Năm',
    last30Days: '30 ngày',
    last12Months: '12 tháng',
    last10Years: '10 năm',

    // Stats cards
    totalPnl: 'Tổng lãi/lỗ',
    winRate: 'Tỉ lệ thắng',
    allTimePnl: 'Tổng mọi thời',
    totalSessions: 'Tổng phiên',
    wl: '{w}W / {l}L',
    wrAllTime: 'WR {wr}% all-time',

    // Chart
    chartTitle: 'Biểu đồ lãi/lỗ',
    profit: 'Lãi',
    loss: 'Lỗ',
    noData: 'Chưa có dữ liệu. Hãy check-in ngày đầu tiên!',

    // History list
    historyTitle: 'Lịch sử check-in',
    noHistory: 'Chưa có check-in nào',
    wallets: '{n} ví',
    deposit: '+{amount} nạp',

    // FinanceOverview widget
    widgetTitle: 'Trading Journal',
    notCheckedIn: 'Chưa check-in hôm nay',
    viewEdit: 'Xem / Sửa',
    checkinCta: '+ Check-in',

    // Modal — general
    modalTitle: 'Trading Check-in',
    stepSetup: 'Chọn ví theo dõi',
    stepInput: 'Nhập kết quả hôm nay',
    stepSummary: 'Xác nhận check-in',

    // Modal — step 1 setup
    setupDesc: 'Chọn các ví bạn muốn theo dõi lãi/lỗ mỗi ngày. Bạn có thể thay đổi sau.',
    noWallets: 'Chưa có ví nào. Hãy tạo ví trước.',
    walletRequired: 'Chọn ít nhất 1 ví để theo dõi.',

    // Modal — step 2 input
    noWalletsSelected: 'Chưa có ví nào được chọn.',
    balanceBefore: 'Số dư: {amount}',
    pnlLabel: 'Lãi / Lỗ',
    pnlHint: '(âm = lỗ)',
    depositLabel: 'Nạp thêm vốn',
    depositHint: '(tuỳ chọn)',
    balanceAfter: 'Số dư sau:',
    noteLabel: 'Ghi chú phiên (tuỳ chọn)',
    notePlaceholder: 'Nhận xét ngắn về phiên giao dịch hôm nay...',
    inputRequired: 'Nhập lãi/lỗ hoặc nạp tiền cho ít nhất 1 ví.',

    // Modal — step 3 summary
    summaryTotal: 'Tổng lãi / lỗ hôm nay',
    summaryDeposit: '+ {amount} nạp thêm',
    summaryNote: 'Ghi chú',
    balanceChange: '{before} → {after}',

    // Modal — footer buttons
    cancel: 'Huỷ',
    next: 'Tiếp theo',
    backToWallets: '← Ví',
    viewSummary: 'Xem tổng kết',
    backToEdit: '← Sửa',
    confirm: 'Xác nhận check-in',
    update: 'Cập nhật',
    saving: 'Đang lưu...',

    // Toast
    successCheckin: 'Check-in thành công! 🎯',
    successUpdate: 'Cập nhật thành công! ✅',
    errorCheckin: 'Không thể lưu check-in. Vui lòng thử lại.',
    errorUpdate: 'Không thể cập nhật check-in. Vui lòng thử lại.',

    // Daily reminder
    reminderTitle: 'Nhắc nhở hàng ngày',
    reminderDesc: 'Nhận thông báo nhắc bạn check-in lãi/lỗ mỗi ngày đúng giờ',
    reminderSetBtn: 'Đặt giờ nhắc',
    reminderActive: 'Đang nhắc lúc {time} ⏰',
    reminderOff: 'Chưa đặt giờ nhắc',
    reminderPresets: 'Chọn nhanh',
    reminderCustom: 'Tuỳ chỉnh',
    reminderSaved: 'Đã đặt giờ nhắc lúc {time} 🔔',
    reminderDisabled: 'Đã tắt nhắc nhở',
    reminderSaveError: 'Không thể lưu, thử lại nhé.',
    reminderTurnOff: 'Tắt nhắc nhở',

    // USD exchange rate
    loadingRate: 'Đang tải tỷ giá...',
    usingUsd: '(đang dùng USD)',
    noExchangeRate: 'Chưa có tỷ giá'
  },

  // ── Planning Hub ──
  planning: {
    description:
      'Trung tâm kiểm soát tài chính nâng cao. Lên kế hoạch, theo dõi mục tiêu và làm chủ dòng tiền của bạn.'
  },

  // ── Debt/Loan ──
  debt: {
    title: 'Quản lý nợ/vay',
    description: 'Theo dõi các khoản nợ, khoản vay và lịch thanh toán',
    add: 'Thêm khoản nợ',
    addNew: 'Thêm khoản nợ/vay mới',
    borrowed: 'Tôi vay',
    lent: 'Tôi cho vay',
    remaining: 'Còn lại',
    paid: 'Đã trả',
    overdue: 'Quá hạn',
    dueSoon: 'Sắp đến hạn',
    active: 'Đang hoạt động',
    completed: 'Đã hoàn tất',
    counterparty: 'Người/Tổ chức',
    counterpartyPlaceholder: 'VD: Ngân hàng ABC, Anh Minh...',
    titlePlaceholder: 'VD: Vay mua xe, Nợ anh A...',
    interestRate: 'Lãi suất (%/năm)',
    startDate: 'Ngày bắt đầu',
    dueDate: 'Ngày đáo hạn',
    totalBorrowed: 'Tổng nợ',
    totalLent: 'Tổng cho vay',
    markPaid: 'Đánh dấu đã trả',
    empty: 'Chưa có khoản nợ/vay nào',
    emptyHint: 'Thêm khoản vay mua nhà, xe, hoặc nợ bạn bè để theo dõi',
    deleteTitle: 'Xóa khoản nợ',
    deleteMessage: 'Khoản nợ/vay này sẽ bị xóa khỏi hệ thống.',
    count: '{n} khoản',
    interestRateUnit: 'năm'
  },

  // ── Onboarding ──
  onboarding: {
    welcome: 'Chào mừng đến với FinNote!',
    welcomeDesc: 'Ứng dụng quản lý tài chính cá nhân thông minh',
    step1Title: 'Chọn ngôn ngữ',
    step2Title: 'Tạo ví đầu tiên',
    step2Desc: 'Thêm ví tiền để bắt đầu theo dõi',
    step3Title: 'Ngân sách tháng',
    step3Desc: 'Đặt mục tiêu chi tiêu (có thể bỏ qua)',
    step4Title: 'Trợ lý AI sẵn sàng!',
    step4Desc:
      'FinNote có AI phân tích tài chính, tự động ghi nhận giao dịch từ SMS ngân hàng, và ghi chú thông minh.',
    skip: 'Bỏ qua',
    next: 'Tiếp tục',
    back: 'Quay lại',
    start: 'Bắt đầu sử dụng!',
    walletNamePlaceholder: 'VD: Vietcombank, MoMo, Tiền mặt...',
    initialBalance: 'Số dư ban đầu',
    monthlyBudget: 'Mục tiêu chi tiêu tháng'
  },

  // ── Notifications ──
  notifications: {
    title: 'Thông báo',
    new: '{n} mới',
    readAll: 'Đọc tất cả',
    deleteAll: 'Xóa',
    tabAll: 'Tất cả',
    tabUnread: 'Chưa đọc',
    emptyUnread: 'Không có thông báo chưa đọc',
    empty: 'Chưa có thông báo nào',
    emptyHint: 'Kết nối ngân hàng để nhận thông báo tự động',
    justNow: 'Vừa xong',
    smsOut: '[SMS] Tiền ra tài khoản',
    smsIn: '[SMS] Tiền vào tài khoản'
  },

  // ── Dashboard ──
  dashboard: {
    totalBalance: 'Tổng số dư',
    monthIncome: 'Thu nhập tháng',
    monthExpense: 'Chi tiêu tháng',
    myWallets: 'Ví của tôi',
    manage: 'Quản lý',
    weeklyChart: 'Thu chi 7 ngày',
    income: 'Thu',
    expense: 'Chi',
    categoryBreakdown: 'Chi tiêu theo danh mục',
    walletBreakdown: 'Thống kê theo ví',
    noDataThisMonth: 'Chưa có dữ liệu tháng này',
    recentTransactions: 'Giao dịch gần đây',
    viewAll: 'Xem tất cả',
    noTransactions: 'Chưa có giao dịch',
    noTransactionsHint: 'Thêm giao dịch đầu tiên hoặc chat trên Telegram',
    addTransaction: 'Thêm giao dịch',
    monthlyBudget: 'Ngân sách tháng',
    aiAssistant: 'Trợ lý AI',
    smartInsights: 'Tổng quan tự động',
    notSet: 'Chưa đặt',
    notSetFull: 'Chưa đặt ngân sách',
    setBudget: 'Đặt ngân sách',
    spent: 'Đã chi',
    remaining: 'Còn lại',
    dailyRemaining: 'Mỗi ngày còn',
    dailyRemainingValue: '~{val}/ngày',
    aiReady: 'Sẵn sàng',
    insightsCount: 'thông báo',
    notEnoughData: 'Chưa đủ dữ liệu để phân tích',
    askAiPlaceholder: 'Hỏi AI cách tối ưu chi tiêu...',
    collapse: 'Thu gọn',
    expand: 'Mở rộng',
    smartFinance: 'Tài chính thông minh',
    skipBudget: 'Bỏ qua',
    budgetDismissed: 'Bạn đã bỏ qua thiết lập ngân sách',
    reEnableBudget: 'Thiết lập lại',
    setBudgetTitle: 'Đặt mục tiêu chi tiêu',
    setBudgetHint: 'NHập số tiền bạn muốn chi trong tháng → AI sẽ lập kế hoạch tự động',
    setBudgetLabel: 'Mục tiêu chi tiêu cả tháng (VNĐ)',
    setBudgetSubhint: '⚡ Sau khi lưu, AI sẽ tự động phân tích và gợi ý kế hoạch cho bạn',
    analyzeAndSave: 'Lưu & Phân tích',
    analyzeWithAi: 'Phân tích và lập kế hoạch chi tiêu',
    refresh: 'Làm mới',
    greetingMorning: 'Chào buổi sáng',
    greetingAfternoon: 'Chào buổi chiều',
    greetingEvening: 'Chào buổi tối',
    welcomeBack: 'Chào bạn, {name}! 👋',
    welcomeDesc: 'Chúc bạn một ngày quản lý tài chính hiệu quả và tiết kiệm được nhiều tiền nhé.',
    toggleBalance: 'Ẩn/hiện số dư',
    aiAdvisorTitle: 'Trợ lý tài chính AI',
    accountCount: '{n} tài khoản',
    monthlyNetFlow: 'Dòng tiền tháng này',
    aiExamplePlaceholder: 'VD: Tôi muốn mua laptop 20tr tháng này, có nên chi không?',
    aiAnalyzing: 'Đang phân tích...',
    askAi: 'Hỏi AI',
    savingToNotes: 'Đang lưu...',
    saveToNotes: 'Lưu vào Notes',
    savedToNotes: 'Đã lưu vào Notes',
    askMore: 'Hỏi tiếp',
    aiEmptyHint: 'Nhập kế hoạch chi tiêu của bạn → AI sẽ tư vấn dựa trên số dư thực tế',
    aiPlanTitle: '📊 Kế hoạch tài chính - {date}',
    aiPlanFooter: '*Tạo tự động bởi AI Finance Advisor*',
    aiPlanDate: '*Ngày: {date}*',
    aiTooltip: 'Meow! {name} có thể giúp gì không? 👋',
    aiReadyToHelp: 'Sẵn sàng hỗ trợ tài chính',
    aiGreeting:
      'Chào bạn! 👋 Mình là {name}. Mình có thể giúp bạn phân tích chi tiêu, đưa ra lời khuyên hoặc giải đáp thắc mắc về tài chính tháng này. Bạn muốn hỏi gì nào?',
    totalAssets: 'Tổng tài sản',
    walletBalance: 'Số dư ví',
    stocksLabel: 'Cổ phiếu',
    fundsLabel: 'Chứng chỉ quỹ',
    monthlySavings: 'Tiết kiệm',
    incomePercent: '% thu nhập'
  },

  // ── Transactions ──
  transactions: {
    title: 'Giao dịch',
    count: '{n} giao dịch',
    add: 'Thêm',
    filterAll: 'Tất cả',
    filterExpense: 'Chi',
    filterIncome: 'Thu',
    allWallets: 'Tất cả ví',
    deleteTitle: 'Xóa giao dịch',
    deleteMessage: 'Giao dịch này sẽ bị xóa khỏi hệ thống.\nHành động này không thể hoàn tác.',
    deleteConfirm: 'Xóa giao dịch',
    empty: 'Chưa có giao dịch',
    emptyHint: 'Thêm giao dịch thủ công hoặc chat qua Telegram',
    addTransaction: 'Thêm giao dịch',
    pinDeleteTitle: 'Xác nhận xóa giao dịch',
    pinDeleteMessage: 'Giao dịch từ {source} được bảo vệ. Nhập mã PIN để xóa.',
    tableTransaction: 'Giao dịch',
    tableWallet: 'Tài khoản',
    tableSource: 'Nguồn',
    tableAmount: 'Số tiền',
    pagination: 'Hiển thị {start}-{end} / {total}',
    tableDate: 'Ngày',
    created: 'Tạo lúc',
    export: 'Xuất CSV',
    exportSuccess: 'Xuất file thành công',
    date: 'Ngày',
    type: 'Loại',
    category: 'Danh mục',
    amount: 'Số tiền',
    wallet: 'Ví',
    source: 'Nguồn'
  },

  // ── Add Transaction ──
  addTx: {
    title: 'Thêm giao dịch',
    expense: 'Chi tiêu',
    income: 'Thu nhập',
    amount: 'Số tiền',
    category: 'Danh mục',
    wallet: 'Ví',
    addWallet: 'Thêm ví',
    note: 'Ghi chú',
    notePlaceholder: 'Ví dụ: Ăn sáng, Grab, ...',
    date: 'Ngày',
    submitExpense: 'Ghi chi tiêu',
    submitIncome: 'Ghi thu nhập'
  },

  // ── Wallets ──
  wallets: {
    title: 'Ví của tôi',
    addWallet: 'Thêm ví',
    addNew: 'Thêm ví mới',
    walletName: 'Tên ví (VD: Vietcombank, MoMo, Tiền mặt...)',
    popularBanks: 'Ngân hàng & Ví phổ biến',
    colorCustom: 'Màu (cho ví tùy chỉnh)',
    totalAll: 'Tổng tất cả ví',
    editBalance: 'Sửa số dư',
    deleteWallet: 'Xóa ví',
    deleteTitle: 'Xóa ví',
    deleteMessage: 'Bạn có chắc chắn muốn xóa ví này?\nCác giao dịch hiện tại sẽ không bị xóa.',
    deleteConfirm: 'Chắc chắn xóa',
    cannotSaveOrder: 'Không thể lưu thứ tự ví',
    pinDeleteTitle: 'Xác nhận xóa ví',
    pinDeleteMessage: 'Nhập mã PIN để xóa ví này',
    customLogo: 'Logo tuỳ chỉnh',
    logoOptional: '(không bắt buộc)',
    logoPasteUrl: 'Dán link URL',
    logoUploadImage: 'Upload ảnh',
    logoUrlError: 'Không load được ảnh từ URL này. Thử URL khác.',
    logoUploading: 'Đang tải...',
    logoChooseFile: 'Chọn file ảnh (PNG, JPG, SVG, WEBP, max 300KB)',
    logoUploaded: '✓ Ảnh đã được tải lên',
    logoTooLarge: 'Ảnh quá lớn. Vui lòng chọn ảnh dưới 300KB.',
    logoInvalidType: 'Chỉ chấp nhận file ảnh (PNG, JPG, SVG, WEBP).',
    logoReadError: 'Không thể đọc file. Thử lại.'
  },

  // ── Notes ──
  notes: {
    title: 'Notes',
    count: '{n} notes',
    newNote: 'Ghi chú mới',
    scanEvents: 'Quét sự kiện',
    typeTag: 'Nhập tag...',
    addTag: 'Thêm tag',
    untitledNote: 'Ghi chú không có tiêu đề',
    searchPlaceholder: 'Tìm kiếm theo tiêu đề, nội dung hoặc tag...',
    filterAll: 'Tất cả',
    filterPinned: 'Ghim',
    filterRecent: 'Gần đây',
    noContent: 'Chưa có nội dung...',
    deleteTitle: 'Xóa ghi chú',
    deleteMessage: 'Ghi chú này sẽ bị xóa khỏi hệ thống.\nHành động này không thể hoàn tác.',
    deleteConfirm: 'Chắc chắn xóa',
    deleteNote: 'Xóa ghi chú này?',
    noteDeleted: 'Đã xóa ghi chú',
    noResults: 'Không tìm thấy kết quả',
    noNotes: 'Chưa có ghi chú',
    tryDifferent: 'Thử từ khóa khác',
    createFirst: 'Tạo ghi chú đầu tiên của bạn',
    createNote: 'Tạo ghi chú',
    createBlogBtn: 'Tạo Blog',
    shareBtn: 'Chia sẻ',
    share: {
      title: 'Chia sẻ ghi chú',
      access: 'Quyền truy cập',
      private: 'Cá nhân',
      privateDesc: 'Chỉ bạn và email được mời',
      public: 'Công khai',
      publicDesc: 'Ai có link cũng xem được',
      inviteEmail: 'Mời qua Email',
      emailPlaceholder: 'Nhập email...',
      shareLink: 'Liên kết chia sẻ',
      copySuccess: 'Đã sao chép',
      copy: 'Sao chép',
      updateSuccess: 'Đã cập nhật quyền chia sẻ',
      updateError: 'Lỗi khi chia sẻ ghi chú'
    },
    blog: {
      generating: 'AI đang viết Blog, vui lòng chờ...',
      success: 'Đã tạo Blog thành công!',
      error: 'Lỗi khi tạo blog'
    },
    ai: {
      assistant: 'Trợ lý AI',
      summarize: 'Tóm tắt',
      continue: 'Viết tiếp',
      improve: 'Cải thiện',
      tags: 'Gợi ý tags',
      ask: 'Hỏi AI về nội dung note...',
      processing: 'Đang xử lý...',
      suggestedTags: 'Gợi ý tags:',
      applyTags: 'Áp dụng tags',
      result: 'Kết quả:',
      insert: 'Chèn vào note'
    }
  },

  // ── Shared Note ──
  sharedNote: {
    notFound: 'Không tìm thấy ghi chú hoặc bạn không có quyền truy cập.',
    loginRequired: 'Bạn cần đăng nhập để xem ghi chú này.',
    noAccess: 'Bạn không có quyền truy cập ghi chú này.',
    cannotAccess: 'Không thể truy cập',
    goHome: 'Về trang chủ',
    noTags: 'Không có thẻ',
    updated: 'Cập nhật',
    shareLabel: 'Chia sẻ'
  },

  // ── Settings ──
  settings: {
    title: 'Cài đặt',
    tabs: {
      general: 'Chung',
      profile: 'Cá nhân',
      security: 'Bảo mật',
      other: 'Khác'
    },
    // App Installation (PWA)
    appDownload: 'Cài đặt Ứng dụng',
    pwaInstallTitle: 'Cài đặt FinNote (PWA)',
    pwaInstallDesc:
      'Trải nghiệm ứng dụng toàn màn hình, mượt mà hơn và không cần tải qua App Store/CH Play.',
    pwaIosTarget: '📱 Trên iOS (Safari):',
    pwaIosStep:
      'Nhấn nút <strong>Chia sẻ (Share)</strong> ở thanh dưới > Chọn <strong>Thêm vào Màn hình chính</strong>.',
    pwaAndroidTarget: '🤖 Trên Android (Chrome):',
    pwaAndroidStep:
      'Nhấn nút <strong>Menu (3 chấm)</strong> ở góc phải > Chọn <strong>Thêm vào Màn hình chính</strong>.',
    pwaDesktopTarget: '💻 Trên Desktop (Chrome/Edge):',
    pwaDesktopStep:
      'Nhấn vào biểu tượng <strong>Cài đặt (Install)</strong> ở góc phải thanh địa chỉ trình duyệt.',
    // Language
    language: 'Ngôn ngữ',
    languageDesc: 'Chọn ngôn ngữ hiển thị',
    confirmLargeTransfer: 'Xác nhận chuyển khoản lớn',
    confirmLargeTransferDesc: 'Hỏi xác nhận chuyển ví khi phát hiện giao dịch chi tiêu lớn trên 3 triệu',
    stocks: 'Chứng khoán',
    enableStocks: 'Bật module Chứng khoán',
    enableStocksDesc:
      'Quản lý danh mục đầu tư và theo dõi giá cổ phiếu (Chỉ hỗ trợ thị trường Việt Nam)',
    // Currency
    currency: 'Tiền tệ',
    currencyDisplay: 'Đơn vị tiền tệ',
    currencyDesc: 'Chọn đơn vị hiển thị. Tỷ giá được cập nhật tự động hàng ngày.',
    // Profile
    profile: 'Hồ sơ',
    editProfile: 'Chỉnh sửa hồ sơ',
    displayName: 'Tên hiển thị',
    avatarUrl: 'Đường dẫn ảnh đại diện',
    avatarHint: 'Dán URL ảnh đại diện công khai.',
    removeAvatar: 'Xóa ảnh đại diện',
    saveChanges: 'Lưu thay đổi',
    profileUpdated: 'Cập nhật hồ sơ thành công',
    profileFailed: 'Không thể cập nhật hồ sơ',
    // Storage
    storage: 'Lưu trữ',
    localStorageUsed: 'Dung lượng Local Storage',
    totalNotes: 'Tổng Notes',
    r2Limit: 'Giới hạn R2 Free Tier',
    // Export
    dataManagement: 'Quản lý dữ liệu',
    exportNotes: 'Xuất Notes',
    exportDesc: 'Tải xuống tất cả ghi chú dưới dạng JSON',
    exportData: 'Xuất dữ liệu',
    exportSuccess: 'Xuất notes thành công',
    // PIN
    pinSecurity: 'Bảo mật PIN',
    changePin: 'Đổi mã PIN',
    setupPin: 'Thiết lập mã PIN',
    pinEnabled: 'PIN đang bật. Các thao tác quan trọng sẽ yêu cầu xác nhận PIN.',
    pinDisabled: 'Bảo vệ các thao tác quan trọng bằng mã PIN.',
    pinActive: 'Đã bật',
    currentPin: 'PIN hiện tại',
    currentPinPlaceholder: 'Nhập PIN cũ',
    newPin: 'PIN mới (4 số)',
    newPinPlaceholder: 'Nhập PIN mới',
    confirmPin: 'Xác nhận PIN',
    confirmPinPlaceholder: 'Nhập lại PIN',
    savePin: 'Lưu PIN',
    savingPin: 'Đang lưu...',
    pinLengthError: 'PIN phải đúng 4 chữ số',
    pinDigitsOnly: 'PIN chỉ được chứa số',
    pinMismatch: 'PIN xác nhận không khớp',
    pinSuccess: 'PIN đã được thiết lập thành công!',
    pinFailed: 'Không thể thiết lập PIN',
    forgotPin: 'Quên PIN?',
    forgotPinDesc: 'Đặt lại PIN bằng mật khẩu tài khoản',
    // Account
    account: 'Tài khoản',
    signOut: 'Đăng xuất',
    signOutDesc: 'Đăng xuất khỏi tài khoản',
    deleteAccount: 'Xóa tài khoản',
    deleteAccountDesc: 'Xóa vĩnh viễn tài khoản và toàn bộ dữ liệu',
    deleteAccountTitle: 'Xóa tài khoản',
    deleteAccountWarning:
      'Hành động này <strong>không thể hoàn tác</strong>. Mọi dữ liệu (ví, giao dịch, ghi chú) sẽ bị xóa vĩnh viễn.',
    confirmPassword: 'Mật khẩu xác nhận',
    passwordPlaceholder: 'Nhập mật khẩu của bạn',
    deleteForever: 'Xóa vĩnh viễn',
    passwordRequired: 'Vui lòng nhập mật khẩu',
    accountDeleted: 'Tài khoản đã được xóa vĩnh viễn',
    wrongPassword: 'Mật khẩu không chính xác',
    pinResetFailed: 'Đặt lại PIN thất bại',
    fallbackRate: 'đang dùng tỷ giá dự phòng',
    updateFailed: 'Cập nhật thất bại',
    // Push Notifications
    pushNotifications: 'Thông báo',
    pushDesc: 'Nhận thông báo giao dịch ngân hàng ngay trên màn hình khóa',
    pushEnable: 'Bật thông báo',
    pushDisable: 'Tắt thông báo',
    pushEnabled: 'Đã bật — Bạn sẽ nhận thông báo giao dịch trên thiết bị',
    pushDisabled: 'Nhận thông báo giao dịch như một ứng dụng thực thụ',
    pushNotSupported: 'Trình duyệt không hỗ trợ thông báo',
    pushDenied: 'Quyền thông báo đã bị từ chối. Vui lòng vào Cài đặt thiết bị để bật lại.',
    pushInstallHint:
      '📱 Để nhận thông báo trên iOS, bạn cần cài FinNote lên Màn hình chính trước (Add to Home Screen)',
    pushPermissionDenied: 'Quyền thông báo bị từ chối',
    pushSubscribeSuccess: '🔔 Đã bật thông báo!',
    pushSubscribeFailed: 'Không thể bật thông báo',
    pushUnsubscribeSuccess: 'Đã tắt thông báo',
    pushUnsubscribeFailed: 'Không thể tắt thông báo',
    // Obsidian Sync
    obsidianSync: 'Đồng bộ Obsidian (Desktop)',
    obsidianSyncDesc: 'Đồng bộ trực tiếp ghi chú vào thư mục Obsidian trên máy tính.',
    localVaultConnection: 'Kết nối Vault',
    notConnected: 'Chưa kết nối. Chỉ hỗ trợ trên Chrome/Edge (Desktop).',
    connected: 'Đã kết nối với thư mục vault',
    connectVault: 'Kết nối Vault',
    disconnectVault: 'Ngắt kết nối'
  },

  // ── Login ──
  login: {
    tagline: 'Quản lý tài chính cá nhân',
    welcomeBack: 'Chào mừng trở lại',
    createAccount: 'Tạo tài khoản',
    signInDesc: 'Đăng nhập để tiếp tục',
    signUpDesc: 'Bắt đầu tổ chức suy nghĩ của bạn',
    name: 'Tên',
    namePlaceholder: 'Họ và tên',
    email: 'Email',
    password: 'Mật khẩu',
    signIn: 'Đăng nhập',
    signUp: 'Đăng ký',
    noAccount: 'Chưa có tài khoản?',
    hasAccount: 'Đã có tài khoản?',
    forgotPassword: 'Quên mật khẩu?',
    backToLogin: 'Quay lại đăng nhập',
    goBack: 'Quay lại',
    orContinueWith: 'hoặc tiếp tục với',
    continueWithGoogle: 'Tiếp tục với Google',
    guestMode: 'Dùng thử miễn phí (Lưu tại máy - 7 ngày)',
    guestExpired: 'Thời gian dùng thử 7 ngày đã hết. Vui lòng đăng nhập để đồng bộ và tiếp tục.',
    welcomeTitle: 'Chào mừng đến FinNote! 👋',
    welcomeDesc: 'Quản lý tài chính thông minh, ghi chú cá nhân và theo dõi đầu tư — tất cả trong một ứng dụng.',
    actionLogin: 'Đăng nhập / Đăng ký'
  },

  // ── Forgot Password / PIN ──
  forgot: {
    // Forgot Password
    title: 'Quên mật khẩu',
    desc: 'Nhập email đăng ký để xác minh qua Google và đặt lại mật khẩu.',
    emailPlaceholder: "you{'@'}example.com",
    googleOAuthHint:
      'Bạn sẽ được chuyển đến Google để xác minh quyền sở hữu email. Vui lòng đăng nhập đúng tài khoản Google đã đăng ký.',
    verifyWithGoogle: 'Xác minh bằng Google',
    googleVerifying: 'Đang xác minh...',
    googleVerifyingDesc: 'Vui lòng chờ trong khi chúng tôi xác minh tài khoản Google của bạn.',
    googleVerified: 'Xác minh Google thành công!',
    googleVerifyFailed: 'Xác minh thất bại',
    emailVerified: 'Email {email} đã được xác minh',
    tryAgain: 'Thử lại',
    doneTitle: 'Thành công!',
    // New password
    newPassTitle: 'Đặt mật khẩu mới',
    newPassDesc: 'Tạo mật khẩu mới cho tài khoản của bạn.',
    newPassword: 'Mật khẩu mới',
    confirmPassword: 'Xác nhận mật khẩu',
    newPassPlaceholder: 'Tối thiểu 6 ký tự',
    confirmPassPlaceholder: 'Nhập lại mật khẩu',
    resetPassword: 'Đặt lại mật khẩu',
    resetting: 'Đang đặt lại...',
    resetSuccess: 'Đặt lại mật khẩu thành công! Vui lòng đăng nhập lại.',
    resetFailed: 'Đặt lại mật khẩu thất bại',
    passMismatch: 'Mật khẩu xác nhận không khớp',
    passMinLength: 'Mật khẩu phải có ít nhất 6 ký tự',
    // Forgot PIN
    pinTitle: 'Đặt lại PIN',
    pinVerifyPasswordDesc: 'Nhập mật khẩu tài khoản để xác minh danh tính.',
    pinNewTitle: 'Đặt PIN mới',
    pinNewDesc: 'Nhập PIN mới (4 chữ số).',
    pinResetSuccess: 'Đặt lại PIN thành công!'
  },

  // ── AutoSync ──
  autoSync: {
    title: 'Đồng bộ tự động (iOS)',
    desc: 'Tự động ghi nhận giao dịch ngân hàng từ SMS vào FinNote thông qua iOS Shortcuts — an toàn, miễn phí, không cần đăng nhập ngân hàng.',
    whyTitle: 'Tại sao nên dùng SMS Shortcuts?',
    security: '<strong>Bảo mật 100%:</strong> Không cần cung cấp mật khẩu đăng nhập ngân hàng.',
    native: '<strong>Apple Native:</strong> Sử dụng Phím tắt (Shortcuts) mặc định của iPhone.',
    free: '<strong>Miễn phí:</strong> Không cần qua trung gian bên thứ 3 nào.',
    instant: '<strong>Tức thì:</strong> SMS biến động số dư → tự động ghi vào FinNote (~30 giây).',
    step1Title: '1. Đường dẫn Webhook của bạn',
    step1Desc:
      'Đường dẫn này chứa mã định danh duy nhất của bạn. Tuyệt đối không chia sẻ cho người khác.',
    step2Title: '2. Hướng dẫn thiết lập trên iPhone',
    s1Title: 'Tạo Tự động hóa mới',
    s1Desc:
      'Mở ứng dụng <strong>Phím tắt (Shortcuts)</strong> trên iPhone → tab <strong>Tự động hóa</strong> ở dưới cùng → bấm <strong>+</strong> góc trên phải.',
    s2Title: 'Chọn điều kiện kích hoạt',
    s2Desc: 'Cuộn xuống chọn mục <strong>Tin nhắn</strong>. Cấu hình như sau:',
    s2Li1: '<strong>Người gửi:</strong> Để mặc định <em>Bất kỳ người gửi nào</em>.',
    s2Li2:
      '<strong>Tin nhắn chứa:</strong> Nhập tên ngân hàng trong ngoặc, VD: <code>(TPBank)</code>, <code>Techcombank</code>, <code>BIDV</code>. Mỗi ngân hàng cần tạo <strong>1 automation riêng</strong>.',
    s2Next:
      'Chọn <strong>Chạy ngay lập tức</strong> → bấm <strong>Tiếp</strong> → chọn <strong>Tạo tự động hóa trống</strong>.',
    s3Title: 'Gắn đường dẫn Webhook',
    s3Desc:
      'Bấm <strong>Thêm hành động</strong> → tìm <strong>"URL"</strong> → chọn <strong>Lấy nội dung URL (Get Contents of URL)</strong>. Dán đường dẫn Webhook ở Bước 1 vào ô URL.',
    s4Title: 'Cấu hình gửi dữ liệu',
    s4Desc: 'Bấm vào mũi tên nhỏ <strong>⌄</strong> (Hiển thị thêm) ở hành động vừa thêm:',
    s4Li1: 'Đổi Phương thức thành <strong>POST</strong>.',
    s4Li2:
      'Kéo xuống phần <strong>Nội dung yêu cầu</strong> → thêm trường mới dạng <strong>Văn bản</strong>.',
    s4Li3: 'Nhập Khóa (Key): <kbd>text</kbd>',
    s4Li4: 'Phần Giá trị (Value): chọn <strong>Đầu vào phím tắt (Shortcut Input)</strong>.',
    s4Done:
      'Bấm <strong>Xong</strong> để lưu. Từ giờ mỗi khi nhận SMS biến động số dư từ ngân hàng, giao dịch sẽ tự động được ghi nhận!',
    copySuccess: 'Đã copy đường dẫn thành công!',
    copyFailed: 'Không thể copy, vui lòng thử lại.',
    revealUrl: 'Hiển thị URL',
    hiddenUrl: '••••••••••••••••••••••••••••••••••••••••••••••••••••••••'
  },

  // ── PinDialog ──
  pin: {
    title: 'Xác nhận bằng PIN',
    message: 'Nhập mã PIN để tiếp tục',
    fillAll: 'Vui lòng nhập đủ PIN',
    wrong: 'PIN không đúng',
    confirm: 'Xác nhận',
    requireTitle: 'Yêu cầu mã PIN',
    requireMessage:
      'Để bảo vệ dữ liệu, bạn cần thiết lập Mã PIN trước khi thực hiện các thao tác quan trọng.',
    setupNow: 'Thiết lập PIN ngay'
  },

  // ── Weather ──
  weather: {
    feelsLike: 'Cảm giác như',
    humidity: 'Độ ẩm',
    wind: 'Gió',
    airQuality: 'Không khí',
    traffic: 'Giao thông',
    refresh: 'Làm mới',
    collapse: 'Thu gọn',
    error: 'Không thể tải thời tiết',
    retry: 'Thử lại',
    cities: {
      'Ho Chi Minh City': 'TP. Hồ Chí Minh',
      Hanoi: 'Hà Nội',
      'Hà Nội': 'Hà Nội',
      Danang: 'Đà Nẵng',
      'Đà Nẵng': 'Đà Nẵng'
    }
  },

  // ── Bug Report ──
  bugReport: {
    sectionTitle: 'Báo lỗi & Góp ý',
    sendReport: 'Gửi phản hồi',
    sendReportDesc: 'Gặp sự cố hoặc có tính năng muốn đóng góp? Hãy cho Admin biết nhé.',
    reportNow: 'Gửi phản hồi',
    adminReports: 'Báo cáo từ người dùng',
    viewReports: 'Xem báo cáo',
    hide: 'Ẩn',
    noReports: 'Chưa có báo cáo nào.',
    sender: 'Người gửi',
    resolved: 'Đã xử lý',
    reopen: 'Mở lại',
    deleteReport: 'Xóa',
    deleteReportTitle: 'Xóa báo cáo',
    deleteReportMsg: 'Bạn chắc chắn muốn xóa báo cáo này?',
    statusUpdated: 'Đã cập nhật trạng thái',
    statusFailed: 'Cập nhật thất bại',
    deleted: 'Đã xóa báo cáo',
    deleteFailed: 'Xóa thất bại',
    // Modal
    modalTitle: 'Báo cáo lỗi / Góp ý',
    modalDesc: 'Cảm ơn bạn đã báo cáo! Thông tin lỗi sẽ được gửi trực tiếp đến Admin để xử lý.',
    typeLabel: 'Loại báo cáo',
    typeBug: '🐛 Báo lỗi',
    typeFeature: '✨ Góp ý / Tính năng mới',
    titleLabel: 'Tiêu đề',
    titlePlaceholder: 'VD: Lỗi không lưu được giao dịch mới',
    descLabel: 'Mô tả chi tiết',
    descPlaceholder: 'Mô tả các bước để tái hiện lỗi...',
    imageLabel: 'Ảnh đính kèm (tùy chọn)',
    imageRemove: 'Xóa ảnh',
    imageDrop: 'Kéo thả ảnh vào đây hoặc',
    imageSelect: 'chọn file',
    imageHint: 'PNG, JPG, GIF — tối đa 2 MB',
    imageTooLarge: 'Ảnh quá lớn. Tối đa 2 MB.',
    autoInfo: 'Thông tin tự động đính kèm',
    submitBtn: 'Gửi báo cáo',
    requiredError: 'Vui lòng nhập đầy đủ Tiêu đề và Mô tả lỗi',
    success: 'Đã gửi báo cáo lỗi thành công!',
    error: 'Lỗi khi gửi báo cáo'
  },

  // ── Contact / Feedback ──
  contact: {
    sectionTitle: 'Liên hệ & Góp ý',
    sendFeedback: 'Gửi ý kiến cho Admin',
    sendFeedbackDesc: 'Có câu hỏi hoặc góp ý? Hãy gửi trực tiếp cho Admin qua email.',
    sendNow: 'Gửi ý kiến',
    modalTitle: 'Gửi ý kiến / Liên hệ',
    modalDesc: 'Nội dung sẽ được gửi trực tiếp đến email Admin để phản hồi nhanh chóng.',
    emailInfo: 'Email Admin:',
    subjectLabel: 'Tiêu đề',
    subjectPlaceholder: 'VD: Góp ý giao diện, Hỏi về tính năng...',
    messageLabel: 'Nội dung',
    messagePlaceholder: 'Viết ý kiến, câu hỏi hoặc góp ý của bạn...',
    submitBtn: 'Gửi ý kiến',
    requiredError: 'Vui lòng nhập đầy đủ Tiêu đề và Nội dung',
    success: 'Đã gửi ý kiến thành công! Admin sẽ phản hồi sớm.',
    error: 'Lỗi khi gửi ý kiến'
  },

  // ── Categories ──
  categories: {
    food: 'Ăn uống',
    transport: 'Di chuyển',
    shopping: 'Shopping',
    entertainment: 'Giải trí',
    bills: 'Hóa đơn',
    health: 'Sức khỏe',
    education: 'Học tập',
    rent: 'Nhà/Thuê',
    gift: 'Quà tặng',
    bank_transfer: 'Chuyển khoản',
    bank_fee: 'Phí ngân hàng',
    subscription: 'Đăng ký dịch vụ',
    other_expense: 'Khác',
    salary: 'Lương',
    freelance: 'Freelance',
    investment: 'Đầu tư',
    bonus: 'Thưởng',
    refund: 'Hoàn tiền',
    bank_receive: 'Nhận CK',
    other_income: 'Thu khác',
    saving: 'Tiết kiệm'
  },

  // ── Guide ──
  guide: {
    syncTitle: 'Bạn có biết?',
    syncMessage:
      'FinNote hỗ trợ đồng bộ giao dịch ngân hàng tự động qua iOS Shortcuts mà không cần đăng nhập tài khoản ngân hàng.',
    syncAction: 'Tìm hiểu ngay'
  },

  // ── PWA Install Guide ──
  pwa: {
    installTitle: 'Cài FinNote lên iPhone',
    installDesc: 'Chạy như app native — toàn màn hình, không cần App Store',
    step1: 'Nhấn <strong>Share</strong> (🔲↑) ở thanh dưới Safari',
    step2: 'Chọn <strong>"Thêm vào Màn hình chính"</strong>',
    iosNativeOption: 'Hoặc cài đặt Native App:',
    downloadIpa: 'Tải file .IPA',
    ipaInstruction:
      '*Yêu cầu sử dụng máy tính cài qua <strong>AltStore</strong>, <strong>Sideloadly</strong>, hoặc dùng thiết bị đã có <strong>TrollStore</strong>.'
  },

  // ── Blog ──
  blog: {
    // Admin page
    manageTitle: 'Quản Lý Blog',
    manageDesc: 'Trang quản trị nội dung blog FinNote',
    newPost: 'Bài viết mới',
    empty: 'Chưa có bài viết nào.',
    // Table
    tableTitle: 'Tiêu đề',
    tableStatus: 'Trạng thái',
    tableDate: 'Ngày tạo',
    tableActions: 'Thao tác',
    statusPublished: 'Đã đăng',
    statusDraft: 'Nháp',
    // Modal
    modalTitle: 'Soạn bài viết mới',
    tabAiGenerate: 'AI Viết Bài',
    tabPasteMarkdown: 'Paste Markdown',
    aiHint: 'Gõ ý tưởng hoặc dán ảnh (Ctrl+V) — AI sẽ tự viết toàn bộ bài blog.',
    pasteHint: 'Dán nội dung Markdown sẵn có — AI sẽ tự trích xuất tiêu đề, mô tả, tags.',
    aiTopicPlaceholder: 'VD: Tiết kiệm như nào là hợp lý cho Gen Z?',
    pasteMarkdownPlaceholder: '# Tiêu đề bài viết\n\nDán nội dung markdown của bạn vào đây...',
    generateBtn: 'Phân tích & Tạo bài',
    generating: 'AI đang xử lý...',
    analyzing: 'Đang phân tích nội dung...',
    aiWriting: 'AI đang viết bài...',
    generatingCover: 'Đang tạo ảnh bìa...',
    generateSuccess: 'Đã tạo xong bài viết!',
    generateFailed: 'Lỗi khi tạo bài viết',
    // Preview
    previewLabel: 'Xem trước bài viết',
    editInput: 'Quay lại chỉnh sửa',
    // Publish
    publishBtn: 'Xuất Bản Blog',
    missingContent: 'Vui lòng tạo bài viết trước khi xuất bản',
    published: 'Đã xuất bản bài viết!',
    publishFailed: 'Lỗi khi xuất bản',
    // Delete
    deleteConfirm: 'Bạn có chắc chắn muốn xóa bài viết này?',
    deleted: 'Đã xóa bài viết',
    // Public pages
    listTitle: 'Blog Tài Chính',
    listDesc: 'Kiến thức quản lý tài chính cá nhân và các mẹo sử dụng FinNote hiệu quả.',
    readMore: 'Đọc tiếp',
    emptyPublic: 'Chưa có bài viết nào',
    emptyPublicHint: 'Các bài viết mới sẽ sớm được cập nhật.',
    backToList: 'Quay lại danh sách',
    editor: 'Biên tập viên FinNote',
    minRead: 'phút đọc',
    // App Intro CTA
    appIntroTitle: 'FinNote — Quản lý tài chính thông minh',
    appIntroDesc:
      'Theo dõi thu chi, đồng bộ giao dịch ngân hàng tự động, AI phân tích tài chính cá nhân — tất cả trong một ứng dụng miễn phí.',
    appIntroFeature1: 'Tự động ghi nhận giao dịch qua SMS',
    appIntroFeature2: 'AI phân tích & tư vấn chi tiêu',
    appIntroFeature3: 'Dashboard trực quan, dễ sử dụng',
    appIntroCta: 'Dùng thử miễn phí',
    appIntroNote: 'Không cần tải app — chạy trực tiếp trên trình duyệt'
  },

  // ── Recurring ──
  recurring: {
    title: 'Giao dịch định kỳ',
    count: '{n} mục',
    add: 'Thêm',
    addNew: 'Thêm giao dịch định kỳ',
    frequency: 'Tần suất',
    daily: 'Hàng ngày',
    weekly: 'Hàng tuần',
    monthly: 'Hàng tháng',
    yearly: 'Hàng năm',
    startDate: 'Ngày bắt đầu',
    next: 'Tiếp theo',
    monthlyEstimate: 'Ước tính hàng tháng',
    activeCount: '{n} đang hoạt động',
    empty: 'Chưa có giao dịch định kỳ',
    emptyHint: 'Thêm tiền nhà, Netflix, lương... để tự động nhắc nhở',
    deleteTitle: 'Xóa giao dịch định kỳ',
    deleteMessage: 'Giao dịch định kỳ này sẽ bị xóa.'
  },

  // ── Budget ──
  budget: {
    title: 'Ngân sách tháng',
    setupTitle: 'Đặt mục tiêu chi tiêu',
    setupHint: 'Nhập số tiền → AI tự phân bổ theo danh mục',
    inputPlaceholder: '0',
    saveAndAnalyze: 'Lưu & Phân tích AI',
    monthlyBudget: 'Ngân sách tháng',
    remaining: 'Còn lại',
    spent: 'Đã chi',
    ofBudget: 'ngân sách',
    byCategory: 'Chi tiêu theo danh mục',
    aiAnalysis: 'Phân tích AI',
    reset: 'Đặt lại'
  },

  // ── Savings ──
  savings: {
    title: 'Mục tiêu tiết kiệm',
    count: '{n} mục tiêu',
    add: 'Thêm',
    addNew: 'Thêm mục tiêu tiết kiệm',
    namePlaceholder: 'VD: Du lịch Nhật, Mua laptop...',
    icon: 'Biểu tượng',
    color: 'Màu sắc',
    targetPlaceholder: 'Số tiền mục tiêu',
    deadline: 'Hạn chót',
    totalSaved: 'Tổng đã tiết kiệm',
    totalTarget: 'Tổng mục tiêu',
    daysLeft: 'Còn {n} ngày',
    perDay: 'ngày',
    addMoney: 'Nạp / Rút tiền',
    empty: 'Chưa có mục tiêu',
    emptyHint: 'Tạo hũ tiết kiệm cho các mục tiêu của bạn',
    deleteTitle: 'Xóa mục tiêu',
    deleteMessage: 'Mục tiêu tiết kiệm này sẽ bị xóa.',
    autoSaveTitle: 'Smart Auto-Save',
    autoSaveDesc: 'Hệ thống sẽ tự động gửi thông báo nhắc nhở và giúp bạn trích tiền vào quỹ này một cách nhanh chóng.',
    autoSaveSource: 'Nguồn tiền trích tự động',
    autoSaveSourceExt: 'Trích tiền ngoài (Không trừ ví)',
    autoSaveAmount: 'Số tiền trích mỗi lần gợi ý',
    autoSaveDisable: 'Tắt Auto-Save',
    autoSaveEnable: 'Bật Auto-Save',
    autoSaveExtractBtn: 'Trích {amount}',
    depositSuccess: 'Trích tiền thành công!',
    depositNoWallet: 'Không tìm thấy ví phù hợp để trích',
    depositError: 'Lỗi khi trích tiền',
    notificationTitle: 'Tiết kiệm thông minh: {name}',
    notificationBody: 'Bạn đã bật trích tiền tự động. Bạn có muốn chuyển {amount} vào mục tiêu này ngay bây giờ không?',
    approveExtract: 'Đồng ý trích {amount}',
    processing: 'Đang xử lý...',
    // AI Planner
    aiPlannerText: 'Mít tính toán giúp bạn nhé! Bạn muốn đạt mục tiêu này trong bao lâu?',
    oneMonth: '1 Tháng',
    threeMonths: '3 Tháng',
    sixMonths: '6 Tháng',
    oneYear: '1 Năm',
    savingsSuggestion: 'Gợi ý tiết kiệm:',
    or: 'hoặc',
    perWeek: '/tuần',
    perDayText: '/ngày',
    applyAiPlan: 'Áp dụng ngày hạn & Auto-save ({amount}/ngày)',
    autoSaveSourceLabel: 'Nguồn Auto-Save',
    chooseWallet: 'Chọn ví',

    // HomeSavingsWidget labels
    targetLabel: 'Mục tiêu',
    achievedLabel: 'Đã đạt'
  },

  // ── Subscriptions ──
  subs: {
    title: 'Đăng ký dịch vụ',
    desc: 'Tự động phát hiện các khoản chi định kỳ từ lịch sử giao dịch',
    monthlyTotal: 'Tổng chi hàng tháng',
    upcoming: '{n} sắp đến hạn',
    nextBill: 'Tiếp theo',
    detected: 'lần phát hiện',
    soon: 'Sắp tới',
    empty: 'Chưa phát hiện đăng ký',
    emptyHint:
      'Thêm giao dịch để hệ thống tự động phát hiện các khoản chi định kỳ (Netflix, Spotify, gym...)'
  },

  // ── Weekly Event ──
  weeklyEvent: {
    title: 'Sự Kiện Hàng Tuần (AI)',
    skip: 'Bỏ qua tuần này',
    join: 'Tham gia ngay',
    success: 'Đã tham gia! Chúc bạn một tuần vui vẻ!',
    generatingImage: 'AI đang vẽ ảnh minh họa...',
    topics: {
      t1_title: 'Thử thách Tiết kiệm 500k',
      t1_desc:
        'Tuần này, hãy thử cắt giảm những chi tiêu không cần thiết như trà sữa, cà phê ngoài để tiết kiệm 500k nhé!',
      t2_title: 'Dọn dẹp Tài chính',
      t2_desc:
        'Dành 15 phút tuần này để rà soát lại các khoản chi tiêu nhỏ lẻ tuần qua. Bạn sẽ bất ngờ đấy!',
      t3_title: 'Quy tắc 50/30/20',
      t3_desc:
        'Bạn đã áp dụng quy tắc 50/30/20 chưa? Hãy chia thu nhập của bạn cho Nhu cầu, Mong muốn và Tiết kiệm nhé.'
    }
  },

  // ── Reminders ──
  reminders: {
    title: 'Lời nhắc',
    subtitle:
      'AI tự động phát hiện sự kiện từ ghi chú. Nhắc trước deadline để không bỏ lỡ điều gì.',
    create: 'Tạo lời nhắc',
    edit: 'Sửa lời nhắc',
    titleField: 'Tiêu đề',
    titlePlaceholder: 'VD: Họp team, Đóng tiền nhà, Trả nợ...',
    descField: 'Mô tả',
    descPlaceholder: 'Ghi chú thêm (không bắt buộc)',
    eventDate: 'Ngày',
    eventTime: 'Giờ',
    offsets: 'Nhắc trước',
    offsetsHint: 'Chọn thời điểm nhắc hoặc nhập giờ tùy chỉnh bên dưới',
    beforeHours: 'Theo giờ',
    beforeDays: 'Theo ngày',
    addCustomTime: 'Thêm giờ tùy chỉnh',
    customTime: 'Thời gian tùy chỉnh',
    repeat: 'Tần suất lặp lại',
    repeatNone: 'Không lặp',
    repeatDaily: 'Hàng ngày',
    repeatWeekly: 'Hàng tuần',
    repeatMonthly: 'Hàng tháng',
    lastChanceInfo:
      'Nếu bạn chưa xác nhận "Đã nhớ", hệ thống sẽ tự động gửi thông báo lần cuối trước deadline 1 giờ.',
    all: 'Tất cả',
    active: 'Đang hoạt động',
    completed: 'Đã hoàn thành',
    expired: 'Đã hết hạn',
    empty: 'Chưa có lời nhắc nào',
    emptyDesc: 'Tạo lời nhắc để không bỏ lỡ sự kiện quan trọng',
    deleteConfirm: 'Xóa lời nhắc',
    deleteMessage: 'Lời nhắc này sẽ bị xóa khỏi hệ thống.',
    markComplete: 'Hoàn thành',
    markedComplete: 'Đã đánh dấu hoàn thành',
    markAcknowledged: 'Xác nhận đã nhớ',
    iRemember: 'Đã nhớ',
    remembered: 'Đã xác nhận',
    acknowledged: 'Đã xác nhận — sẽ không nhắc lần cuối',
    fromNote: 'Từ Ghi chú',
    created: 'Đã tạo lời nhắc',
    updated: 'Đã cập nhật lời nhắc',
    deleted: 'Đã xóa lời nhắc',
    aiDetected: 'AI phát hiện sự kiện',
    aiDetectedDesc: 'AI đã phát hiện sự kiện trong ghi chú. Bạn có muốn tạo lời nhắc?',
    quickAdd: 'Thêm nhanh',
    noEventsFound: 'Không tìm thấy sự kiện nào trong nội dung',
    timelineToday: 'Hôm nay',
    timelineTomorrow: 'Ngày mai',
    timelineDaysAgo: '{n} ngày trước',
    timelineDaysLeft: '{n} ngày nữa',
    timelineHoursLeft: '{n} giờ nữa',
    timelineMinsLeft: '{n} phút nữa',
    widgetTitle: 'Nhắc nhở sắp tới',
    deleteAll: 'Xóa tất cả',
    deleteAllTitle: 'Xóa lời nhắc',
    deleteAllMessage: 'Bạn có chắc chắn muốn xóa tất cả lời nhắc {filter} không? Hành động này không thể hoàn tác.',
    cleanupBtn: 'Dọn dẹp ({n})',
    cleanupTitle: 'Dọn dẹp quá hạn',
    clearSuccess: 'Đã xóa thành công',
    // CleanupExpiredModal
    cleanupModalTitle: 'Dọn dẹp nhắc nhở quá hạn',
    cleanupDesc: 'Bạn có {n} nhắc nhở đã quá thời gian.',
    cleanupSuccess: 'Đã dọn dẹp các mục quá hạn',
    deleteAllSelected: 'Xóa tất cả',
    deleteSelected: 'Xóa đã chọn ({n})',
    // CreateReminderModal
    aiQuickAdd: 'Tạo nhanh bằng AI',
    aiPlaceholder: 'vd: Hẹn gặp khách lúc 3h chiều mai, nhắc trước 1 tiếng...',
    orManual: 'Hoặc điền thủ công',
    // Offset chip labels
    offset15m: '15 phút',
    offset30m: '30 phút',
    offset1h: '1 giờ',
    offset2h: '2 giờ',
    offset3h: '3 giờ',
    offset1d: '1 ngày',
    offset2d: '2 ngày',
    offset3d: '3 ngày',
    offset1w: '1 tuần',
    // Batch add (ReminderSuggestionModal)
    batchAddAll: 'Thêm nhanh tất cả ({n})',
    batchTitle: 'Thêm {n} lời nhắc',
    batchDesc: 'Các sự kiện deadline nên được nhắc trước tối thiểu 1 ngày.',
    batchRemindBefore: 'Nhắc trước bao lâu?',
    batchConfirm: 'Xác nhận thêm'
  },

  // ── Coffee ──
  coffee: {
    title: 'Buy me a coffee ☕',
    desc: 'Cảm ơn bạn đã sử dụng FinNote! Nếu thấy ứng dụng hữu ích, bạn có thể mời mình một ly cà phê nhé.',
    bankName: 'TP Bank',
    accountName: 'TRUONG NHU TUAN'
  },

  // ── AI To-Do ──
  aiTodo: {
    title: 'AI To-Do',
    subtitle: 'Chat với AI để lên kế hoạch ngày hiệu quả',
    placeholder: 'VD: 9h sáng họp standup, 2h chiều code feature login, 5h gym...',
    generate: 'Tạo To-Do',
    processing: 'AI đang phân tích...',
    noTasksFound: 'AI không tìm thấy công việc nào trong nội dung',
    pushReminder: 'Lời nhắc',
    pushedToReminder: 'Đã thêm vào Lời nhắc',
    alreadyReminder: 'Đã có lời nhắc',
    markDone: 'Hoàn thành',
    markPending: 'Chưa xong',
    pending: 'Chờ làm',
    inProgress: 'Đang làm',
    done: 'Xong',
    all: 'Tất cả',
    today: 'Hôm nay',
    upcoming: 'Sắp tới',
    overdue: 'Quá hạn',
    empty: 'Chưa có công việc nào',
    emptyDesc: 'Chat với AI để tạo danh sách công việc thông minh',
    progress: 'Tiến độ',
    tasksDone: '{done}/{total} xong',
    priorityLow: 'Thấp',
    priorityMedium: 'Trung bình',
    priorityHigh: 'Cao',
    priorityUrgent: 'Khẩn cấp',
    deleteConfirm: 'Xóa công việc',
    deleteMessage: 'Công việc này sẽ bị xóa.',
    deleted: 'Đã xóa công việc',
    created: 'Đã tạo {n} công việc',
    clearAll: 'Xóa tất cả',
    catWork: 'Công việc',
    catPersonal: 'Cá nhân',
    catHealth: 'Sức khỏe',
    catFinance: 'Tài chính',
    catStudy: 'Học tập',
    catOther: 'Khác',
    suggestTitle: 'AI đề xuất công việc',
    suggestDesc: 'Kiểm tra và chỉnh sửa trước khi thêm',
    suggestConfirm: 'Tạo tất cả',
    suggestSkip: 'Bỏ qua',
    timelineToday: 'Hôm nay',
    timelineTomorrow: 'Ngày mai',
    timelineDaysAgo: '{n} ngày trước',
    timelineDaysLeft: '{n} ngày nữa',
    timelineOverdue: 'Quá hạn'
  },

  // ── Landing Page ──
  landing: {
    nav: {
      login: 'Đăng nhập',
      tryNow: 'Dùng thử ngay',
      starting: 'Đang vào...'
    },
    hero: {
      badge: 'Quản lý tiền bạc hệ "không nhức đầu"',
      titlePart1: 'Chữa bệnh',
      titlePart2: '"đầu tháng tỷ phú, cuối tháng ăn mì"',
      description: 'FinNote tự động hoá mớ bòng bong tài chính của bạn bằng AI. Quét SMS tự động, quản lý đầu tư, và tư vấn chi tiêu chân thật như một người bạn thân.',
      ctaPrimary: 'Trải nghiệm miễn phí 7 ngày',
      ctaSecondary: 'Tìm hiểu thêm',
      privacyNote: '100% dữ liệu nằm trên máy bạn. Không lưu pass ngân hàng.'
    },
    demoVideo: 'Trải nghiệm thực tế',
    demo: {
      dashboard: 'Dashboard',
      planning: 'Kế hoạch',
      stocks: 'Chứng khoán',
      totalAssets: 'Tổng tài sản',
      thisMonth: '+12% tháng này',
      aiAdvisor: 'AI Advisor Meow',
      aiMessage: '"Hôm nay bạn chi 500k tiền cafe rồi đấy. Nếu bớt uống Starbucks lại thì tháng này để dành được dư sức mua PS5 nha!"',
      syncSms: 'Vừa đồng bộ SMS',
      coffee: 'Highland Coffee',
      salary: 'Lương tháng 5',
      actionTitle: 'FinNote in Action',
      actionDesc: 'Xem sự mượt mà khi quản lý tài chính'
    },
    stats: {
      activeUsers: 'Người Dùng',
      localPrivacy: 'Bảo mật Cục bộ'
    },
    features: {
      title: 'Có gì hay ho trong FinNote?',
      subtitle: 'Trải nghiệm thế hệ ứng dụng quản lý tài chính tiếp theo.',
      sms: {
        title: 'Tự động đọc SMS Ngân hàng',
        desc: 'Không cần cặm cụi nhập từng đồng như thời tiền sử nữa. FinNote sử dụng Apple Shortcuts bắt thẳng thông báo biến động số dư và ghi nhận ngay lập tức.'
      },
      privacy: {
        title: 'Bảo mật là chân ái',
        desc: 'Không lưu mật khẩu. Không kết nối API lằng nhằng. Dữ liệu của bạn nằm gọn trong máy (Local-first). Chúng mình không thèm ngó đâu.'
      },
      allInOne: {
        title: 'All-in-One Finance',
        desc: 'Ví tiền mặt, cổ phiếu, nợ nần, tiết kiệm mua xe... tất cả nằm trên một giao diện mượt như bơ.'
      },
      knowledge: {
        title: 'Không chỉ là tiền, còn là Kiến thức',
        desc: 'Tích hợp sẵn Markdown Note xịn xò. Note lại bài học đầu tư, lập kế hoạch trả nợ, đồng bộ thẳng với Obsidian, hay thậm chí biến nó thành trang Blog công khai 1-click.'
      }
    },
    cta: {
      title: 'Sẵn sàng để làm chủ ví tiền?',
      desc: 'Mở app lên, nhấn nút Dùng thử là xong. Thề không rườm rà.',
      button: 'Dùng thử 7 ngày không cần thẻ',
      starting: 'Đang thiết lập...'
    },
    showcase: {
      title: 'Dashboard thực tế',
      subtitle: 'Mọi thứ bạn cần, trên một màn hình — trực quan, mượt mà, không rối.',
      balance: 'Tổng số dư',
      income: 'Thu nhập',
      expense: 'Chi tiêu',
      weeklyChart: 'Biểu đồ 7 ngày',
      walletBreakdown: 'Phân bổ theo ví',
      recentTx: 'Giao dịch gần đây',
      ago: 'trước',
      tx: {
        salary: 'Lương tháng 5',
        food: 'Highland Coffee',
        shopping: 'Shopee',
        electricity: 'Tiền điện'
      }
    },
    contactModal: {
      title: 'Liên hệ với FinNote',
      desc: 'Có câu hỏi hay ý tưởng? Gửi tin nhắn cho đội ngũ FinNote — chúng mình sẽ phản hồi sớm nhất.',
      name: 'Họ tên',
      namePlaceholder: 'Nhập họ tên của bạn',
      emailPlaceholder: "email{'@'}example.com",
      subject: 'Tiêu đề',
      subjectPlaceholder: 'VD: Hỏi về tính năng, Góp ý giao diện...',
      message: 'Nội dung',
      messagePlaceholder: 'Viết nội dung bạn muốn gửi...',
      submit: 'Gửi liên hệ',
      cancel: 'Hủy',
      successTitle: 'Đã mở ứng dụng Email!',
      successDesc: 'Vui lòng nhấn Gửi trong ứng dụng email để hoàn tất liên hệ.',
      close: 'Đóng'
    },
    footer: {
      copyright: '© 2026 FinNote. Made with 🤍 for better financial freedom.',
      privacy: 'Bảo mật',
      terms: 'Điều khoản',
      contact: 'Liên hệ'
    }
  },

  // ── Transfer Confirmation ──
  transfer: {
    confirmLargeTitle: 'Xác nhận giao dịch lớn',
    largeTransactionDetected: 'Phát hiện chi tiêu trên 3,000,000đ',
    amountSent: 'Số tiền chuyển đi:',
    fromWallet: 'Từ ví:',
    content: 'Nội dung:',
    date: 'Ngày:',
    isInternalQuestion: 'Đây có phải là chuyển khoản nội bộ (chuyển sang ví khác của bạn) không?',
    isInternalHint: 'Nếu là chuyển nội bộ, hệ thống sẽ tự động cân đối và không tính giao dịch này vào mục tiêu chi tiêu tháng (tránh bị báo đỏ ngân sách).',
    disableFutureHint: 'Tắt tính năng tự động hỏi xác nhận này trong tương lai. (Có thể bật lại trong Cài đặt)',
    yesInternal: 'Đúng vậy, là chuyển khoản nội bộ',
    noItIsExpense: 'Không phải, đây là chi tiêu thực tế',
    sourceWallet: 'Ví chuyển đi (Nguồn)',
    targetWallet: 'Ví nhận tiền (Đích)',
    selectWalletPlaceholder: '-- Chọn ví nhận --',
    balance: 'Số dư',
    transferAmount: 'Số tiền chuyển khoản',
    confirmAndFinish: 'Xác nhận & Hoàn tất',
    selectTargetWallet: 'Vui lòng chọn ví nhận tiền',
    internalTransferSuccess: 'Đã ghi nhận chuyển khoản nội bộ thành công',
    confirmedAsExpense: 'Đã xác nhận là chi tiêu thực tế',
    recordError: 'Đã xảy ra lỗi khi ghi nhận'
  },

  // ── OTP Hub ──
  otpHub: {
    title: 'OTP Hub',
    subtitle: 'Mã xác thực tài khoản chia sẻ',
    subscribe: 'Nhận thông báo',
    subscribed: 'Đã đăng ký',
    subscribedBanner: 'Bạn sẽ nhận được push notification khi có mã OTP mới!',
    processing: 'Đang xử lý...',
    permissionDenied: 'Bạn đã từ chối quyền thông báo',
    subscribeSuccess: 'Đã đăng ký nhận OTP!',
    unsubscribeSuccess: 'Đã hủy đăng ký nhận OTP',
    subscribeFailed: 'Không thể đăng ký thông báo',
    unsubscribeFailed: 'Không thể hủy đăng ký',
    adminPanel: 'Admin Panel',
    subscribers: 'subscribers',
    service: 'Dịch vụ',
    serviceName: 'Tên dịch vụ',
    serviceNamePlaceholder: 'Nhập tên...',
    otpCode: 'Mã OTP',
    otpCodePlaceholder: 'Nhập mã OTP...',
    expiryMinutes: 'Phút',
    sendOtp: 'Gửi OTP',
    sending: 'Đang gửi...',
    otpRequired: 'Vui lòng nhập mã OTP',
    otpSent: 'Đã gửi OTP {service} đến {count} subscribers',
    otpCreateFailed: 'Không thể tạo OTP',
    otpDeleted: 'Đã xóa OTP',
    otpDeleteFailed: 'Không thể xóa OTP',
    defaultExpiry: 'Thời gian hết hạn mặc định',
    minutes: 'phút',
    save: 'Lưu',
    settingsSaved: 'Đã lưu cài đặt',
    settingsFailed: 'Không thể lưu cài đặt',
    subscribersCount: '{count} người đang đăng ký nhận thông báo',
    justNow: 'vừa xong',
    minutesAgo: '{n} phút trước',
    hoursAgo: '{n} giờ trước',
    daysAgo: '{n} ngày trước',
    expired: 'Đã hết hạn',
    emptyTitle: 'Chưa có mã OTP nào',
    emptyDesc: 'Khi admin gửi mã OTP, bạn sẽ thấy ở đây và nhận được push notification nếu đã đăng ký.',
    emptySubscribe: 'Đăng ký nhận thông báo',
    pushNotSupported: 'Trình duyệt không hỗ trợ Push Notification. Thử mở trên Chrome/Safari hoặc cài FinNote làm PWA.',
    other: 'Khác'
  }
}
