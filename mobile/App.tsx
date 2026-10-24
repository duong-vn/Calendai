import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Alert, AppState, KeyboardAvoidingView, Platform, ScrollView, TextInput, TouchableOpacity, useColorScheme, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useFonts, PlusJakartaSans_400Regular, PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans';
import { useChat } from 'ai/react';
import { CalendarDays, Check, ChevronRight, Clock3, HelpCircle, LogIn, LogOut, Menu, Moon, Plus, Settings2, Sparkles, Sun, Trash2, X } from 'lucide-react-native';
import { Action, Copy, IconButton, mono, palettes, Panel, ThemeContext, useTheme } from './src/theme';
import { authClient, signInGoogle, signOutGoogle } from './src/services/auth';
import { API_ORIGIN } from './src/services/transport';
import { fetchModels, mobileApi } from './src/services/api';
import { historyKey, loadHistory, newConversation, saveHistory } from './src/services/history';
import { openLink } from './src/services/links';
import type { CalendarEvent, ChatSession, MeetingProposal, ModelOption, UserProfile } from './src/types';
import { AgendaCard } from './src/components/AgendaCard';
import { ChatMessage } from './src/components/ChatMessage';
import { Sheet } from './src/components/Sheet';
import { VoiceAssistantBar } from './src/components/VoiceAssistantBar';

const PROMPTS = ['Họp nhóm lúc 9h sáng mai trong 1 tiếng, có Google Meet', 'Xem các cuộc họp sắp tới', 'Hẹn cà phê chiều thứ Sáu lúc 15h'];
type Page = 'history' | 'models' | 'upcoming' | 'help' | 'account' | null;
type ThemeMode = 'system' | 'light' | 'dark';

export default function App() {
  const system = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>('system');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const session = useSyncExternalStore(authClient.subscribe, authClient.getSnapshot);
  const [fonts, fontError] = useFonts({ Jakarta: PlusJakartaSans_400Regular, JakartaBold: PlusJakartaSans_700Bold });
  const dark = mode === 'dark' || mode === 'system' && system === 'dark';
  useEffect(() => {
    let live = true;
    void Promise.all([
      authClient.restore().catch(() => { if (live) setError('Không khôi phục được phiên. Vui lòng đăng nhập Google lại.'); }),
      AsyncStorage.getItem('calendai.theme.v1').then(value => { if (live && (value === 'system' || value === 'light' || value === 'dark')) setMode(value); }).catch(() => { if (live) setError('Không đọc được tùy chọn giao diện trên thiết bị.'); }),
    ]).finally(() => { if (live) setReady(true); });
    return () => { live = false; };
  }, []);
  const login = async () => {
    if (loggingIn) return;
    setLoggingIn(true); setError('');
    try { await signInGoogle(); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Không thể đăng nhập.'); }
    finally { setLoggingIn(false); }
  };
  const logout = async () => {
    setError('');
    try { await signOutGoogle(); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Chưa đăng xuất được. Vui lòng thử lại.'); }
  };
  const changeTheme = (next: ThemeMode) => {
    setMode(next);
    void AsyncStorage.setItem('calendai.theme.v1', next).catch(() => setError('Chưa lưu được tùy chọn giao diện.'));
  };
  return <SafeAreaProvider><ThemeContext.Provider value={{ colors: dark ? palettes.dark : palettes.light, dark, fonts }}>
    <SafeAreaView style={{ flex: 1, backgroundColor: dark ? palettes.dark.bg : palettes.light.bg }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      {!ready || !fonts && !fontError ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 }}><ActivityIndicator color={dark ? palettes.dark.accent : palettes.light.accent} /><Copy>Đang mở Calendai…</Copy></View> :
        <Workspace key={`${API_ORIGIN}:${session?.user.id || 'guest'}`} user={session?.user || null} error={error} clearError={() => setError('')} login={() => { void login(); }} logout={() => { void logout(); }} loggingIn={loggingIn} mode={mode} changeTheme={changeTheme} />}
    </SafeAreaView>
  </ThemeContext.Provider></SafeAreaProvider>;
}

function Workspace({ user, error: authError, clearError, login, logout, loggingIn, mode, changeTheme }: {
  user: UserProfile | null; error: string; clearError: () => void; login: () => void; logout: () => void; loggingIn: boolean; mode: ThemeMode; changeTheme: (mode: ThemeMode) => void;
}) {
  const { colors, dark } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 850;
  const [page, setPage] = useState<Page>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [active, setActive] = useState<ChatSession>(newConversation);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [models, setModels] = useState<ModelOption[]>([]);
  const [model, setModel] = useState('');
  const [modelsError, setModelsError] = useState('');
  const [search, setSearch] = useState('');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventsError, setEventsError] = useState('');
  const [eventsLoading, setEventsLoading] = useState(false);
  const [calendarStatus, setCalendarStatus] = useState('');
  const alive = useRef(true);
  const sessionsRef = useRef(sessions);
  const deletedIds = useRef(new Set<string>());
  const activeRef = useRef(active);
  const calendarAbort = useRef<AbortController | null>(null);
  const modelAbort = useRef<AbortController | null>(null);
  const updateActive = (next: ChatSession) => { activeRef.current = next; setActive(next); };
  const commit = useCallback(async (next: ChatSession) => {
    if (deletedIds.current.has(next.id)) return;
    const all = [next, ...sessionsRef.current.filter(item => item.id !== next.id)].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 50);
    sessionsRef.current = all;
    if (alive.current) setSessions(all);
    try { await saveHistory(user?.id || null, all); }
    catch (failure) { if (alive.current) setError('Chưa lưu được lịch sử trên thiết bị. Vui lòng thử lại trước khi rời ứng dụng.'); throw failure; }
  }, [user?.id]);
  const loadModels = useCallback(async () => {
    modelAbort.current?.abort();
    const controller = new AbortController(); modelAbort.current = controller;
    setModelsError('');
    try {
      const result = await fetchModels(controller.signal);
      const saved = await AsyncStorage.getItem(`${historyKey(user?.id || null)}:model`);
      if (!alive.current || controller.signal.aborted) return;
      setModels(result.models);
      setModel(saved && result.models.some(item => item.id === saved) ? saved : result.defaultModel);
    } catch { if (alive.current && !controller.signal.aborted) setModelsError('Không tải được danh sách mô hình. Bạn vẫn có thể dùng mô hình mặc định của máy chủ.'); }
  }, [user?.id]);
  useEffect(() => {
    void loadHistory(user?.id || null).then(items => {
      if (!alive.current) return;
      sessionsRef.current = items; setSessions(items);
      if (items[0]) updateActive(items[0]);
      setLoaded(true);
    }).catch(() => { if (alive.current) setError('Không đọc được lịch sử. Để tránh ghi đè dữ liệu, hãy đóng và mở lại ứng dụng.'); });
    void loadModels();
    if (user) {
      const controller = new AbortController();
      calendarAbort.current = controller;
      void mobileApi.status(controller.signal).then(status => {
        if (!alive.current) return;
        setCalendarStatus(status.authenticated ? 'Google Calendar đã kết nối' : 'Google Calendar chưa kết nối. Vui lòng đăng nhập lại.');
      }).catch(() => { if (alive.current && !controller.signal.aborted) setCalendarStatus('Chưa kiểm tra được kết nối Google Calendar.'); });
    }
    return () => { alive.current = false; calendarAbort.current?.abort(); modelAbort.current?.abort(); };
  }, [user?.id, loadModels]);
  const loadEvents = async () => {
    calendarAbort.current?.abort();
    const controller = new AbortController(); calendarAbort.current = controller;
    setEventsLoading(true); setEventsError('');
    try { const data = await mobileApi.upcoming(controller.signal); if (alive.current && !controller.signal.aborted) setEvents(data); }
    catch { if (alive.current && !controller.signal.aborted) setEventsError('Không tải được lịch. Kiểm tra mạng, quyền Google Calendar hoặc đăng nhập lại.'); }
    finally { if (alive.current && !controller.signal.aborted) setEventsLoading(false); }
  };
  const openPage = (next: Page) => { setPage(next); if (next === 'upcoming' && user) { void loadEvents(); } };
  const deleteConversation = (id: string) => Alert.alert('Xóa cuộc trò chuyện?', 'Chỉ xóa lịch sử trên thiết bị, không xóa sự kiện trên Google Calendar.', [{ text: 'Giữ lại', style: 'cancel' }, { text: 'Xóa', style: 'destructive', onPress: () => {
    deletedIds.current.add(id);
    if (activeRef.current.id === id) updateActive(newConversation());
    const next = sessionsRef.current.filter(item => item.id !== id);
    void saveHistory(user?.id || null, next).then(() => {
      if (!alive.current) return;
      sessionsRef.current = next; setSessions(next);
      if (activeRef.current.id === id) updateActive(newConversation());
    }).catch(() => { if (alive.current) setError('Không xóa được lịch sử. Vui lòng thử lại.'); });
  } }]);
  const history = <View style={{ gap: 14 }}>
    <Action label="Cuộc trò chuyện mới" icon={Plus} primary onPress={() => { updateActive(newConversation()); setPage(null); }} />
    <Copy style={{ color: colors.muted, fontSize: 12 }}>Lưu trên thiết bị · {user?.email || 'Khách'} · Không đồng bộ với web</Copy>
    {sessions.length === 0 && <Copy style={{ color: colors.muted }}>Chưa có cuộc trò chuyện nào.</Copy>}
    {sessions.map(item => <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: item.id === active.id ? colors.raised : 'transparent', borderRadius: 10 }}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Mở ${item.title}`} onPress={() => { updateActive(item); setPage(null); }} style={{ flex: 1, padding: 12, minHeight: 48 }}><Copy numberOfLines={2} strong={item.id === active.id}>{item.title}</Copy><Copy style={{ color: colors.muted, fontSize: 11 }}>{new Date(item.updatedAt).toLocaleDateString('vi-VN')}</Copy></TouchableOpacity>
      <IconButton icon={Trash2} label={`Xóa ${item.title}`} onPress={() => deleteConversation(item.id)} />
    </View>)}
    <Action label="Lịch sắp tới" icon={CalendarDays} onPress={() => openPage('upcoming')} />
    <Action label="Mẹo đặt lịch" icon={HelpCircle} onPress={() => openPage('help')} />
    <Action label={user ? 'Tài khoản & giao diện' : 'Đăng nhập & giao diện'} icon={Settings2} onPress={() => openPage('account')} />
  </View>;
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={{ flexDirection: 'row', borderBottomWidth: 2, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4 }}>
      {!wide && <IconButton icon={Menu} label="Mở lịch sử trò chuyện" onPress={() => openPage('history')} />}
      <View style={{ flex: 1, paddingLeft: wide ? 14 : 0 }}><Copy strong style={{ fontSize: 21, letterSpacing: -0.5 }}>Calendai<Copy style={{ color: colors.accent }}>.</Copy></Copy><Copy style={{ fontSize: 10, fontFamily: mono, color: colors.muted }}>TRỢ LÝ LỊCH HẸN</Copy></View>
      <IconButton icon={CalendarDays} label="Lịch sắp tới" onPress={() => openPage('upcoming')} />
      <IconButton icon={dark ? Sun : Moon} label={dark ? 'Đổi sang giao diện sáng' : 'Đổi sang giao diện tối'} onPress={() => changeTheme(dark ? 'light' : 'dark')} />
      <IconButton icon={user ? Settings2 : LogIn} label={user ? 'Tài khoản Google' : 'Đăng nhập Google'} onPress={() => openPage('account')} />
    </View>
    {Boolean(authError || error) && <View style={{ backgroundColor: colors.raised, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', gap: 8, alignItems: 'center' }}><Copy accessibilityRole="alert" style={{ flex: 1, color: colors.danger, fontSize: 12 }}>{authError || error}</Copy><IconButton icon={X} label="Đóng thông báo" onPress={() => { setError(''); clearError(); }} /></View>}
    <View style={{ flex: 1, flexDirection: 'row' }}>
      {wide && <ScrollView style={{ width: 290, flexGrow: 0, borderRightWidth: 2, borderColor: colors.border, backgroundColor: colors.surface }} contentContainerStyle={{ padding: 16 }}>{history}</ScrollView>}
      <View style={{ flex: 1 }}>
        {!loaded ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.accent} /><Copy>Đang đọc lịch sử…</Copy></View> : <Conversation key={active.id} initial={active} user={user} model={model} modelLabel={models.find(item => item.id === model)?.name || 'Mặc định máy chủ'} onModel={() => openPage('models')} onChange={commit} login={login} blocked={page !== null} />}
      </View>
    </View>
    <Sheet title="Cuộc trò chuyện" visible={page === 'history'} onClose={() => setPage(null)}>{history}</Sheet>
    <Sheet title="Chọn mô hình AI" visible={page === 'models'} onClose={() => setPage(null)}>
      <Copy style={{ color: colors.muted }}>Mô hình và cấu hình do máy chủ cung cấp. Chọn mô hình hỗ trợ công cụ để đặt lịch.</Copy>
      <TextInput accessibilityLabel="Tìm mô hình" value={search} onChangeText={setSearch} placeholder="Tìm tên hoặc nhà cung cấp…" placeholderTextColor={colors.muted} style={{ minHeight: 48, color: colors.ink, borderColor: colors.border, borderWidth: 2, borderRadius: 12, padding: 12, backgroundColor: colors.surface }} />
      {!!modelsError && <><Copy style={{ color: colors.danger }}>{modelsError}</Copy><Action label="Tải lại danh sách" onPress={() => { void loadModels(); }} /></>}
      <Action label="Mặc định máy chủ" icon={!model ? Check : undefined} onPress={() => { setModel(''); setPage(null); void AsyncStorage.removeItem(`${historyKey(user?.id || null)}:model`).catch(() => setError('Chưa lưu được mô hình.')); }} />
      {models.filter(item => `${item.name} ${item.id} ${item.provider}`.toLowerCase().includes(search.toLowerCase())).map(item => <TouchableOpacity key={item.id} accessibilityRole="button" accessibilityState={{ selected: model === item.id }} onPress={() => { setModel(item.id); setPage(null); void AsyncStorage.setItem(`${historyKey(user?.id || null)}:model`, item.id).catch(() => setError('Chưa lưu được mô hình.')); }} style={{ borderWidth: 2, borderColor: model === item.id ? colors.accent : colors.border, borderRadius: 12, backgroundColor: colors.surface, padding: 14, gap: 5 }}><Copy strong>{item.name}{model === item.id ? ' · Đang chọn' : ''}</Copy><Copy style={{ color: colors.muted, fontSize: 12 }}>{item.provider} · {item.supportsTools ? 'Hỗ trợ công cụ' : 'Trò chuyện'}{item.isFree ? ' · Miễn phí' : ''}</Copy></TouchableOpacity>)}
    </Sheet>
    <Sheet title="Lịch sắp tới" visible={page === 'upcoming'} onClose={() => setPage(null)}>
      {!user ? <><Copy>Đăng nhập Google để xem lịch thật của bạn.</Copy><Action label={loggingIn ? 'Đang đăng nhập…' : 'Đăng nhập Google'} icon={LogIn} disabled={loggingIn} primary onPress={login} /></> : <>
        <Copy style={{ color: colors.muted }}>Google Calendar · Giờ Việt Nam</Copy>
        <Action label="Tải lại lịch" icon={Clock3} disabled={eventsLoading} onPress={() => { void loadEvents(); }} />
        {eventsLoading ? <ActivityIndicator color={colors.accent} /> : eventsError ? <Copy accessibilityRole="alert" style={{ color: colors.danger }}>{eventsError}</Copy> : events.length ? events.map(event => <AgendaCard key={event.id} event={event} />) : <Copy>Không có sự kiện sắp tới trong khoảng thời gian này.</Copy>}
      </>}
    </Sheet>
    <Sheet title="Đặt lịch cùng Calendai" visible={page === 'help'} onClose={() => setPage(null)}>
      <Copy strong style={{ fontSize: 20 }}>Bạn nói ý tưởng. Calendai chuẩn bị lịch.</Copy>
      <Copy>Cho biết tên cuộc họp, ngày giờ, thời lượng, email khách mời và có cần Google Meet hay không.</Copy>
      {PROMPTS.map(prompt => <Panel key={prompt}><Copy>{prompt}</Copy></Panel>)}
      <Copy>Kiểm tra kỹ thẻ bản thảo trước khi bấm “Xác nhận tạo lịch”. Nếu cần đổi nội dung, hãy nhắn yêu cầu chỉnh sửa để nhận bản thảo mới.</Copy>
      <Copy>Mic chỉ chuyển lời nói tiếng Việt thành bản nháp để bạn chỉnh lại, không tự gửi hoặc tạo sự kiện. Nhận diện phụ thuộc dịch vụ Google/Apple và mạng trên thiết bị; không đảm bảo ngoại tuyến.</Copy>
      <Copy>Lịch sử được lưu cục bộ theo tài khoản và máy chủ. Đăng xuất không xóa sự kiện đã tạo hoặc thu hồi mọi phiên trên thiết bị khác.</Copy>
    </Sheet>
    <Sheet title="Tài khoản & giao diện" visible={page === 'account'} onClose={() => setPage(null)}>
      <Panel style={{ gap: 10 }}><Copy strong style={{ fontSize: 20 }}>{user?.name || 'Chào bạn'}</Copy><Copy>{user?.email || 'Kết nối Google Calendar để bắt đầu.'}</Copy>{!!calendarStatus && <Copy style={{ color: colors.muted }}>{calendarStatus}</Copy>}
        {user ? <Action label="Đăng xuất trên thiết bị" icon={LogOut} onPress={logout} /> : <Action label={loggingIn ? 'Đang đăng nhập…' : 'Tiếp tục với Google'} icon={LogIn} disabled={loggingIn} primary onPress={login} />}
      </Panel>
      {!!authError && <Copy accessibilityRole="alert" style={{ color: colors.danger }}>{authError}</Copy>}
      <Copy strong>Giao diện</Copy>
      {(['system', 'light', 'dark'] as const).map(item => <Action key={item} label={`${item === 'system' ? 'Theo thiết bị' : item === 'light' ? 'Giấy sáng' : 'Xưởng đêm'}${mode === item ? ' · Đang chọn' : ''}`} icon={mode === item ? Check : undefined} onPress={() => changeTheme(item)} />)}
      <Action label="Chính sách quyền riêng tư" icon={ChevronRight} onPress={() => { void openLink(`${API_ORIGIN}/privacy`).catch(() => setError('Không mở được chính sách quyền riêng tư.')); }} />
      <Action label="Điều khoản dịch vụ" icon={ChevronRight} onPress={() => { void openLink(`${API_ORIGIN}/terms`).catch(() => setError('Không mở được điều khoản dịch vụ.')); }} />
      <Copy style={{ color: colors.muted, fontSize: 12 }}>Phiên ứng dụng được lưu trong SecureStore. Lịch sử trò chuyện chỉ lưu trên thiết bị, không đồng bộ web. Đăng xuất không thu hồi phiên bị sao chép hoặc đăng xuất thiết bị khác.</Copy>
    </Sheet>
  </KeyboardAvoidingView>;
}

function Conversation({ initial, user, model, modelLabel, onModel, onChange, login, blocked }: {
  initial: ChatSession; user: UserProfile | null; model: string; modelLabel: string; onModel: () => void; onChange: (value: ChatSession) => Promise<void>; login: () => void; blocked: boolean;
}) {
  const { colors } = useTheme();
  const [confirmed, setConfirmed] = useState(initial.confirmed);
  const [submitted, setSubmitted] = useState(initial.submitted);
  const [localError, setLocalError] = useState('');
  const scroll = useRef<ScrollView>(null);
  const mounted = useRef(true);
  const confirmedRef = useRef(confirmed);
  const submittedRef = useRef(submitted);
  const messagesRef = useRef(initial.messages);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const sendGuard = useRef(false);
  const { messages, input, setInput, append, reload, stop, isLoading, error } = useChat({
    api: `${API_ORIGIN}/api/chat`, id: `${user?.id || 'guest'}:${initial.id}`,
    initialMessages: initial.messages, fetch: authClient.fetch, credentials: 'omit',
    body: model ? { model } : {}, maxSteps: 5, streamProtocol: 'data', keepLastMessageOnError: true,
  });
  messagesRef.current = messages;
  const snapshot = useCallback((): ChatSession => {
    const first = messagesRef.current.find(message => message.role === 'user');
    return { ...initial, messages: messagesRef.current, confirmed: confirmedRef.current, submitted: submittedRef.current, title: first?.content.slice(0, 70) || initial.title, updatedAt: Date.now() };
  }, [initial]);
  const persist = useCallback(async () => {
    await onChangeRef.current(snapshot());
  }, [snapshot]);
  useEffect(() => {
    if (!messages.length) return;
    const timeout = setTimeout(() => { void persist().catch(() => { if (mounted.current) setLocalError('Chưa lưu được lịch sử trên thiết bị. Vui lòng thử lại trước khi chuyển chat.'); }); }, 600);
    return () => clearTimeout(timeout);
  }, [messages, confirmed, submitted, persist]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') { stop(); void persist().catch(() => { if (mounted.current) setLocalError('Chưa lưu được lịch sử trên thiết bị.'); }); } });
    return () => {
      mounted.current = false;
      stop();
      subscription.remove();
      // Synchronously emit the latest in-memory snapshot before unmounting.
      void onChangeRef.current(snapshot()).catch(() => undefined);
    };
  }, [stop, persist, snapshot]);
  useEffect(() => { if (blocked) stop(); }, [blocked, stop]);
  const send = async (text = input) => {
    const content = text.trim();
    if (!content || isLoading || sendGuard.current) return;
    sendGuard.current = true; setLocalError(''); setInput('');
    try { await append({ role: 'user', content }, { body: model ? { model } : {} }); }
    catch (err) {
      console.error('[Calendai Send Message Error]:', err);
      if (mounted.current) setLocalError(err instanceof Error ? err.message : 'Chưa gửi được tin nhắn. Bạn có thể thử lại.');
    }
    finally { sendGuard.current = false; }
  };
  return <View style={{ flex: 1 }}>
    <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 30, flexGrow: 1, maxWidth: 900, width: '100%', alignSelf: 'center' }} onContentSizeChange={() => { if (isLoading) scroll.current?.scrollToEnd({ animated: false }); }}>
      {messages.length === 0 && <View style={{ flex: 1, justifyContent: 'center', gap: 24, paddingVertical: 24 }}>
        <View style={{ width: 64, height: 64, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.raised, borderRadius: 20, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-5deg' }] }}><Sparkles color={colors.accent} size={30} /></View>
        <View style={{ gap: 12 }}><Copy strong accessibilityRole="header" style={{ fontSize: 32, lineHeight: 40, letterSpacing: -1 }}>Hôm nay, bạn muốn{`\n`}lên lịch gì?</Copy><Copy style={{ color: colors.muted, fontSize: 15 }}>Chỉ cần một lời nhắn. Calendai chuẩn bị cuộc hẹn, bạn là người xác nhận.</Copy></View>
        {!user && <Action label="Kết nối Google Calendar" icon={LogIn} primary onPress={login} />}
        <View style={{ gap: 10 }}>{PROMPTS.map(prompt => <TouchableOpacity key={prompt} accessibilityRole="button" onPress={() => setInput(prompt)} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.surface, padding: 14, minHeight: 50, flexDirection: 'row', gap: 8, alignItems: 'center' }}><Copy style={{ flex: 1 }}>{prompt}</Copy><ChevronRight size={18} color={colors.accent} /></TouchableOpacity>)}</View>
        <Copy style={{ color: colors.muted, fontSize: 11 }}>Giờ Việt Nam · Chỉ tạo lịch sau khi bạn xác nhận</Copy>
      </View>}
      {messages.map(message => <ChatMessage key={message.id} message={message} confirmed={confirmed} submitted={submitted} disabled={isLoading || blocked} onSubmit={async proposal => {
        submittedRef.current = { ...submittedRef.current, [proposal.proposalId]: proposal }; setSubmitted(submittedRef.current); await persist();
      }} onCreated={async (id, event) => {
        confirmedRef.current = { ...confirmedRef.current, [id]: event }; setConfirmed(confirmedRef.current); await persist();
      }} onEdit={proposal => { setInput(`Hãy tạo bản thảo mới cho “${proposal.summary}”, tôi muốn chỉnh: `); scroll.current?.scrollToEnd({ animated: true }); }} />)}
      {isLoading && <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}><ActivityIndicator color={colors.accent} /><Copy style={{ color: colors.muted }}>Calendai đang suy nghĩ…</Copy></View>}
      {Boolean(error || localError) && <Panel style={{ gap: 12 }}>
        <Copy accessibilityRole="alert" style={{ color: colors.danger }}>
          {localError || (error instanceof Error ? error.message : String(error)) || 'Chưa nhận được phản hồi. Kiểm tra kết nối hoặc đăng nhập lại, rồi thử lại.'}
        </Copy>
        <Action label="Thử lại phản hồi" disabled={isLoading} onPress={() => { setLocalError(''); void reload({ body: model ? { model } : {} }).catch(err => setLocalError(err instanceof Error ? err.message : 'Vẫn chưa nhận được phản hồi. Vui lòng thử lại sau.')); }} />
      </Panel>}
    </ScrollView>
    <VoiceAssistantBar value={input} onChange={setInput} onSend={() => { void send(); }} isLoading={isLoading} disabled={false} onStop={stop} modelLabel={modelLabel} onModel={onModel} voiceEnabled={!blocked} />
  </View>;
}
