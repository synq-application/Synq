// SynqScreen.styles.js
import { Platform, StyleSheet } from 'react-native';

const ACCENT = "#7DFFA6";

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  darkFill: { flex: 1, backgroundColor: 'black', justifyContent: 'center' },
  activeHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    paddingHorizontal: 25, 
    paddingTop: Platform.OS === 'ios' ? 60 : 40, 
    paddingBottom: 20, 
    alignItems: 'center' 
  },
  headerTitle: { 
    color: 'white', 
    fontSize: 22, 
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Black' : 'sans-serif-condensed' 
  },
  badge: { 
    position: 'absolute', 
    top: -2, 
    right: -2, 
    width: 8, 
    height: 8, 
    borderRadius: 4, 
    backgroundColor: ACCENT 
  },
  friendCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#111', 
    padding: 15, 
    borderRadius: 20, 
    marginBottom: 12, 
    borderWidth: 1, 
    borderColor: '#222' 
  },
  friendImg: { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
  whiteBold: { 
    color: 'white', 
    fontSize: 17, 
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Heavy' : 'sans-serif-medium' 
  },
  grayText: { 
    color: '#666', 
    fontSize: 13, 
    marginTop: 2, 
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Medium' : 'sans-serif' 
  },
  footer: { padding: 25, paddingBottom: 40 },
  btn: { backgroundColor: ACCENT, padding: 18, borderRadius: 20, alignItems: 'center' },
  btnText: { fontSize: 16, color: 'black', fontFamily: Platform.OS === 'ios' ? 'Avenir-Black' : 'sans-serif-condensed' },
  inactiveCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  mainTitle: { 
    color: 'white', 
    fontSize: 28, 
    textAlign: 'center', 
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Black' : 'sans-serif-condensed' 
  },
  memoInput: { 
    color: 'white', 
    fontSize: 18, 
    borderBottomWidth: 1, 
    borderBottomColor: ACCENT, 
    width: '100%', 
    textAlign: 'center', 
    marginVertical: 40, 
    paddingBottom: 10,
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Medium' : 'sans-serif'
  },
  pulseBox: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  pulseCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center' },
  modalBg: { flex: 1, backgroundColor: '#0A0A0A' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 25, borderBottomWidth: 1, borderBottomColor: '#1A1A1A' },
  modalTitle: { color: 'white', fontSize: 19, flex: 1, fontFamily: Platform.OS === 'ios' ? 'Avenir-Heavy' : 'sans-serif-medium' },
  inboxItem: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#151515' },
  inboxCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  msgRow: { flexDirection: 'row', marginBottom: 15, alignItems: 'flex-end' },
  bubbleImg: { width: 30, height: 30, borderRadius: 15, marginHorizontal: 8 },
  bubble: { padding: 12, borderRadius: 18, maxWidth: '70%' },
  myBubble: { backgroundColor: ACCENT, borderBottomRightRadius: 4 },
  theirBubble: { backgroundColor: '#222', borderBottomLeftRadius: 4 },
  inputRow: { flexDirection: 'row', padding: 15, paddingBottom: Platform.OS === 'ios' ? 40 : 15, backgroundColor: '#050505', alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#151515', borderRadius: 25, paddingHorizontal: 15, paddingVertical: 12, color: 'white' },
  sendBtn: { backgroundColor: ACCENT, width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', marginLeft: 10 }
});