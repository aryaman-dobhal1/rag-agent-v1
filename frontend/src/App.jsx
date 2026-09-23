import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import {
  AlertCircle,
  ArrowUp,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Database,
  Edit3,
  ExternalLink,
  Eye,
  File,
  FileSearch,
  FileText,
  Filter,
  FolderOpen,
  History,
  Layers3,
  Loader2,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
  Zap,
} from 'lucide-react'

const API_BASE = 'http://127.0.0.1:8000'

const DEFAULT_SOURCES = [
  {
    id: 1,
    name: 'Edwards Documents',
    type: 'Document Store',
    records: 0,
    icon: FolderOpen,
    color: 'blue',
    description: 'Company documents, reports, product material and internal references.',
  },
  {
    id: 2,
    name: 'Clinical Research',
    type: 'Research Database',
    records: 0,
    icon: Database,
    color: 'purple',
    description: 'Clinical studies, trials, publications and research records.',
  },
  {
    id: 3,
    name: 'Regulatory Data',
    type: 'Regulatory Database',
    records: 0,
    icon: ShieldCheck,
    color: 'green',
    description: 'Regulatory submissions, approvals, safety and compliance information.',
  },
]

function formatTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString([], { hour: 'numeric', minute: '2-digit' })
}

function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })
}

/* ---------- lightweight markdown renderer (no new dependency) ---------- */

const INLINE_REGEX = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g

function renderInline(text) {
  const parts = String(text).split(INLINE_REGEX).filter((part) => part !== undefined && part !== '')
  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>
    if (/^\*[^*]+\*$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>
    if (/^`[^`]+`$/.test(part)) return <code key={i} className="inline-code" style={{ background: 'rgba(127,127,127,0.18)', borderRadius: 4, padding: '1px 5px', fontSize: '0.9em' }}>{part.slice(1, -1)}</code>
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (linkMatch) return <a key={i} href={linkMatch[2]} target="_blank" rel="noreferrer">{linkMatch[1]}</a>
    return part
  })
}

function renderTextBlock(block, blockIdx) {
  const lines = block.split('\n')
  const out = []
  let listBuffer = []
  let listType = null
  let paraBuffer = []

  const flushPara = (key) => {
    if (paraBuffer.length) {
      out.push(<p key={`p-${blockIdx}-${key}`} style={{ margin: '0 0 8px', lineHeight: 1.55 }}>{renderInline(paraBuffer.join(' '))}</p>)
      paraBuffer = []
    }
  }
  const flushList = (key) => {
    if (listBuffer.length) {
      const items = listBuffer.map((item, li) => <li key={li} style={{ marginBottom: 4, lineHeight: 1.5 }}>{renderInline(item)}</li>)
      if (listType === 'ol') out.push(<ol key={`ol-${blockIdx}-${key}`} style={{ margin: '0 0 8px', paddingLeft: 20 }}>{items}</ol>)
      else out.push(<ul key={`ul-${blockIdx}-${key}`} style={{ margin: '0 0 8px', paddingLeft: 20 }}>{items}</ul>)
      listBuffer = []
      listType = null
    }
  }

  lines.forEach((line, i) => {
    const trimmed = line.trim()
    const headerMatch = trimmed.match(/^(#{1,6})\s+(.*)$/)
    const ulMatch = trimmed.match(/^[-*]\s+(.*)$/)
    const olMatch = trimmed.match(/^\d+\.\s+(.*)$/)

    if (headerMatch) {
      flushPara(i)
      flushList(i)
      const level = headerMatch[1].length
      const key = `h-${blockIdx}-${i}`
      const content = renderInline(headerMatch[2])
      let heading
      if (level === 1) heading = <h1 key={key} style={{ fontSize: '1.35em', margin: '10px 0 6px', fontWeight: 700 }}>{content}</h1>
      else if (level === 2) heading = <h2 key={key} style={{ fontSize: '1.2em', margin: '10px 0 6px', fontWeight: 700 }}>{content}</h2>
      else if (level === 3) heading = <h3 key={key} style={{ fontSize: '1.08em', margin: '8px 0 4px', fontWeight: 600 }}>{content}</h3>
      else heading = <h4 key={key} style={{ fontSize: '1em', margin: '8px 0 4px', fontWeight: 600 }}>{content}</h4>
      out.push(heading)
    } else if (ulMatch) {
      flushPara(i)
      if (listType !== 'ul') flushList(i)
      listType = 'ul'
      listBuffer.push(ulMatch[1])
    } else if (olMatch) {
      flushPara(i)
      if (listType !== 'ol') flushList(i)
      listType = 'ol'
      listBuffer.push(olMatch[1])
    } else if (trimmed === '') {
      flushPara(i)
      flushList(i)
    } else {
      flushList(i)
      paraBuffer.push(trimmed)
    }
  })
  flushPara('end')
  flushList('end')
  return out
}

function renderMarkdown(content) {
  if (!content) return null
  const blocks = String(content).split(/```/g)
  const elements = []
  blocks.forEach((block, idx) => {
    if (idx % 2 === 1) {
      const lines = block.split('\n')
      let code = block
      if (lines[0] && !lines[0].includes(' ') && lines.length > 1) {
        code = lines.slice(1).join('\n')
      }
      elements.push(
        <pre
          key={`code-${idx}`}
          style={{
            background: 'rgba(127,127,127,0.14)',
            borderRadius: 8,
            padding: '10px 12px',
            overflowX: 'auto',
            margin: '6px 0 10px',
            fontSize: '0.88em',
            lineHeight: 1.5,
          }}
        >
          <code>{code.replace(/\n$/, '')}</code>
        </pre>
      )
    } else {
      elements.push(...renderTextBlock(block, idx))
    }
  })
  return elements
}

/* ------------------------------------------------------------------------ */

function App() {
  const [darkMode, setDarkMode] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeView, setActiveView] = useState('chat')
  const [activeConversation, setActiveConversation] = useState(null)

  const [sources, setSources] = useState(DEFAULT_SOURCES)
  const [conversations, setConversations] = useState([])
  const [messages, setMessages] = useState([])
  const [documents, setDocuments] = useState([])

  const [messageInput, setMessageInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [documentSearch, setDocumentSearch] = useState('')

  const [groundedMode, setGroundedMode] = useState(true)
  const [selectedSources, setSelectedSources] = useState([])
  const [showSourceMenu, setShowSourceMenu] = useState(false)
  const [showSourcePanel, setShowSourcePanel] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [showChatMenu, setShowChatMenu] = useState(false)

  const [expandedCitationIds, setExpandedCitationIds] = useState({})
  const [expandedSourceLists, setExpandedSourceLists] = useState({})
  const [copiedMessageId, setCopiedMessageId] = useState(null)
  const [likedMessageId, setLikedMessageId] = useState(null)
  const [dislikedMessageId, setDislikedMessageId] = useState(null)

  const [isGenerating, setIsGenerating] = useState(false)
  const [loadingWorkspace, setLoadingWorkspace] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const [sourceFilter, setSourceFilter] = useState('All')
  const [documentStatusFilter, setDocumentStatusFilter] = useState('All')
  const [showFilters, setShowFilters] = useState(false)

  const [renamingConversation, setRenamingConversation] = useState(null)
  const [renameValue, setRenameValue] = useState('')

  const [renamingDocument, setRenamingDocument] = useState(null)
  const [renameDocumentValue, setRenameDocumentValue] = useState('')
  const [renamingDocumentBusy, setRenamingDocumentBusy] = useState(false)

  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadSourceId, setUploadSourceId] = useState('')
  const [uploadFile, setUploadFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  const currentConversation = conversations.find((item) => item.id === activeConversation)

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations
    const query = searchQuery.toLowerCase()
    return conversations.filter((conversation) => conversation.title.toLowerCase().includes(query))
  }, [conversations, searchQuery])

  const filteredDocuments = useMemo(() => {
    return documents.filter((document) => {
      const query = documentSearch.trim().toLowerCase()
      const matchesSearch = !query || document.name.toLowerCase().includes(query)
      const matchesSource = sourceFilter === 'All' || document.source === sourceFilter
      const normalizedStatus = document.status === 'ready' ? 'Indexed' : document.status === 'error' ? 'Failed' : 'Processing'
      const matchesStatus = documentStatusFilter === 'All' || normalizedStatus === documentStatusFilter
      return matchesSearch && matchesSource && matchesStatus
    })
  }, [documents, documentSearch, sourceFilter, documentStatusFilter])

  const totalChunks = documents.reduce((sum, document) => sum + Number(document.chunks || 0), 0)
  const processingCount = documents.filter((document) => ['processing', 'queued'].includes(document.status) || ['processing', 'queued'].includes(document.job_status)).length

  const refreshSources = async () => {
    const response = await fetch(`${API_BASE}/sources`)
    if (!response.ok) throw new Error('Could not load knowledge sources.')
    const data = await response.json()
    setSources((current) => {
      return data.map((source, index) => {
        const fallback = current[index] || DEFAULT_SOURCES[index]
        return { ...fallback, ...source }
      })
    })
    setSelectedSources((current) => {
      const connectedIds = data.filter((source) => source.connected).map((source) => source.id)
      return current.length
        ? current.filter((id) => connectedIds.includes(id))
        : connectedIds
    })
    return data
  }

  const refreshDocuments = async () => {
    const response = await fetch(`${API_BASE}/documents`)
    if (!response.ok) throw new Error('Could not load documents.')
    const data = await response.json()
    setDocuments(data)
    return data
  }

  const refreshChats = async () => {
    const response = await fetch(`${API_BASE}/chats`)
    if (!response.ok) throw new Error('Could not load conversations.')
    const data = await response.json()
    setConversations(data.map((chat) => ({
      id: chat.id,
      title: chat.title || 'New Chat',
      preview: chat.title || '',
      time: formatTime(chat.created_at),
    })))
    return data
  }

  const loadWorkspace = async () => {
    setLoadingWorkspace(true)
    setErrorMessage('')
    try {
      await Promise.all([refreshSources(), refreshDocuments(), refreshChats()])
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setLoadingWorkspace(false)
    }
  }

  useEffect(() => {
    loadWorkspace()
  }, [])

  const loadMessages = async (chatId) => {
    if (!chatId) {
      setMessages([])
      return
    }

    try {
      const response = await fetch(`${API_BASE}/chats/${chatId}/messages`)
      if (!response.ok) throw new Error('Could not load conversation messages.')
      const data = await response.json()
      setMessages(data.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        time: formatTime(message.created_at),
        sources: message.sources || [],
      })))
    } catch (error) {
      setErrorMessage(error.message)
      setMessages([])
    }
  }

  const setSourceConnection = async (sourceId, connected) => {
    try {
      const action = connected ? 'connect' : 'disconnect'
      const response = await fetch(`${API_BASE}/sources/${sourceId}/${action}`, { method: 'POST' })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.detail || `Could not ${action} source.`)
      }

      await refreshSources()
      await refreshDocuments()
    } catch (error) {
      setErrorMessage(error.message)
    }
  }

  const toggleSource = (sourceId) => {
    const source = sources.find((item) => item.id === sourceId)
    if (!source?.connected) return

    setSelectedSources((current) => {
      if (current.includes(sourceId)) {
        if (current.length === 1) return current
        return current.filter((id) => id !== sourceId)
      }
      return [...current, sourceId]
    })
  }

  const toggleCitation = (citationId) => {
    setExpandedCitationIds((current) => ({ ...current, [citationId]: !current[citationId] }))
  }

  const toggleSourceList = (messageId) => {
    setExpandedSourceLists((current) => ({ ...current, [messageId]: !current[messageId] }))
  }

  const createNewChat = () => {
    setActiveConversation(null)
    setMessages([])
    setActiveView('chat')
    setMessageInput('')
    setShowChatMenu(false)
  }

  const selectConversation = async (id) => {
    setActiveConversation(id)
    setActiveView('chat')
    setShowChatMenu(false)
    await loadMessages(id)
  }

  const sendMessage = async () => {
    const trimmed = messageInput.trim()
    if (!trimmed || isGenerating) return

    if (selectedSources.length === 0) {
      setErrorMessage('Select at least one knowledge source.')
      return
    }

    const optimisticMessage = {
      id: `pending-${Date.now()}`,
      role: 'user',
      content: trimmed,
      time: 'Now',
    }

    setMessages((current) => [...current, optimisticMessage])
    setMessageInput('')
    setIsGenerating(true)
    setErrorMessage('')

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          chat_id: activeConversation,
          source_ids: groundedMode ? selectedSources : null,
          top_k: 6,
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.detail || `Request failed with status ${response.status}.`)

      setActiveConversation(data.chat_id)
      await Promise.all([refreshChats(), refreshDocuments()])
      await loadMessages(data.chat_id)
    } catch (error) {
      setMessages((current) => current.filter((message) => message.id !== optimisticMessage.id))
      setErrorMessage(error.message)
    } finally {
      setIsGenerating(false)
    }
  }

  const regenerate = async () => {
    if (!activeConversation || isGenerating) return

    // Remove the old assistant answer from the UI immediately.
    setMessages((current) => {
      const lastAssistantIndex = [...current]
        .map((message, index) => ({ message, index }))
        .reverse()
        .find(({ message }) => message.role === 'assistant')?.index

      if (lastAssistantIndex === undefined) return current

      return current.filter((_, index) => index !== lastAssistantIndex)
    })

    setIsGenerating(true)
    setErrorMessage('')

    try {
      const response = await fetch(`${API_BASE}/chats/${activeConversation}/regenerate`, {
        method: 'POST',
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.detail || 'Could not regenerate the response.')
      }

      await loadMessages(activeConversation)
      await refreshChats()
    } catch (error) {
      setErrorMessage(error.message)
      await loadMessages(activeConversation)
    } finally {
      setIsGenerating(false)
    }
  }

  const copyMessage = async (message) => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopiedMessageId(message.id)
      setTimeout(() => setCopiedMessageId(null), 1600)
    } catch {
      setCopiedMessageId(message.id)
    }
  }

  const deleteConversation = async () => {
    if (!activeConversation) return
    try {
      const response = await fetch(`${API_BASE}/chats/${activeConversation}`, { method: 'DELETE' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.detail || 'Could not delete chat.')
      setConversations((current) => current.filter((conversation) => conversation.id !== activeConversation))
      setActiveConversation(null)
      setMessages([])
      setShowChatMenu(false)
    } catch (error) {
      setErrorMessage(error.message)
    }
  }

  const startRename = () => {
    if (!currentConversation) return
    setRenameValue(currentConversation.title)
    setRenamingConversation(currentConversation.id)
    setShowChatMenu(false)
  }

  const saveRename = async () => {
    const title = renameValue.trim()
    if (!title || !renamingConversation) return
    try {
      const response = await fetch(`${API_BASE}/chats/${renamingConversation}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.detail || 'Could not rename chat.')
      setConversations((current) => current.map((conversation) => conversation.id === renamingConversation ? { ...conversation, title: data.title } : conversation))
      setRenamingConversation(null)
      setRenameValue('')
    } catch (error) {
      setErrorMessage(error.message)
    }
  }

  const startRenameDocument = (document) => {
    setRenameDocumentValue(document.name)
    setRenamingDocument(document)
  }

  const saveRenameDocument = async () => {
    const name = renameDocumentValue.trim()
    if (!name || !renamingDocument || renamingDocumentBusy) return
    setRenamingDocumentBusy(true)
    setErrorMessage('')
    try {
      const response = await fetch(`${API_BASE}/documents/${renamingDocument.id}/rename`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.detail || 'Could not rename document.')
      setRenamingDocument(null)
      setRenameDocumentValue('')
      await refreshDocuments()
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setRenamingDocumentBusy(false)
    }
  }

  const openUpload = () => {
    const connectedSources = sources.filter((source) => source.connected)

    if (connectedSources.length === 0) {
      setErrorMessage('Connect a knowledge source before uploading a document.')
      return
    }

    const preferred = connectedSources.find((source) => selectedSources.includes(source.id)) || connectedSources[0]
    setUploadSourceId(String(preferred.id))
    setUploadFile(null)
    setShowUploadModal(true)
  }

  const uploadDocument = async () => {
    if (!uploadFile || !uploadSourceId || uploading) return
    setUploading(true)
    setErrorMessage('')
    try {
      const formData = new FormData()
      formData.append('file', uploadFile)
      const response = await fetch(`${API_BASE}/upload?source_id=${encodeURIComponent(uploadSourceId)}`, {
        method: 'POST',
        body: formData,
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.detail || 'Upload failed.')
      setShowUploadModal(false)
      setUploadFile(null)
      await refreshDocuments()
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setUploading(false)
    }
  }

  const retryDocument = async (documentId) => {
    try {
      const response = await fetch(`${API_BASE}/documents/${documentId}/retry`, { method: 'POST' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.detail || 'Could not retry ingestion.')
      await refreshDocuments()
    } catch (error) {
      setErrorMessage(error.message)
    }
  }

  const deleteDocument = async (document) => {
    const confirmed = window.confirm(`Delete ${document.name} and all indexed versions?`)
    if (!confirmed) return
    try {
      const response = await fetch(`${API_BASE}/documents/${encodeURIComponent(document.name)}`, { method: 'DELETE' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.detail || 'Could not delete document.')
      await refreshDocuments()
    } catch (error) {
      setErrorMessage(error.message)
    }
  }

  useEffect(() => {
    if (!documents.some((document) => ['processing', 'queued'].includes(document.status) || ['processing', 'queued'].includes(document.job_status))) return undefined
    const timer = setInterval(() => {
      refreshDocuments().catch((error) => setErrorMessage(error.message))
    }, 1500)
    return () => clearInterval(timer)
  }, [documents])

  return (
    <div className={`app-shell ${darkMode ? 'dark' : 'light'}`}>
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <div className="brand">
            {sidebarOpen && <div className="brand-text"><strong>RAG Assistant</strong></div>}
          </div>
          {sidebarOpen && <button className="icon-button subtle" onClick={() => setSidebarOpen(false)} title="Collapse sidebar"><ChevronLeft size={18} /></button>}
        </div>

        {!sidebarOpen && <button className="sidebar-expand" onClick={() => setSidebarOpen(true)}><ChevronRight size={18} /></button>}

        {sidebarOpen && (
          <>
            <button className="new-chat-button" onClick={createNewChat}><Plus size={18} /><span>New Chat</span></button>
            <div className="sidebar-search">
              <Search size={17} />
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search conversations..." />
              {searchQuery && <button onClick={() => setSearchQuery('')}><X size={15} /></button>}
            </div>

            <nav className="primary-nav">
              <button className={activeView === 'chat' ? 'active' : ''} onClick={() => setActiveView('chat')}><MessageSquare size={18} />Chat</button>
              <button className={activeView === 'knowledge' ? 'active' : ''} onClick={() => setActiveView('knowledge')}><Database size={18} />Knowledge Base</button>
            </nav>

            <div className="sidebar-divider" />
            <div className="conversation-section">
              <div className="section-label"><span>CONVERSATIONS</span><span className="conversation-count">{filteredConversations.length}</span></div>
              <div className="conversation-list">
                {filteredConversations.length === 0 ? (
                  <div className="sidebar-empty">No conversations yet.</div>
                ) : filteredConversations.map((conversation) => (
                  <button key={conversation.id} className={`conversation-item ${activeConversation === conversation.id ? 'active' : ''}`} onClick={() => selectConversation(conversation.id)}>
                    <MessageSquare size={16} />
                    <div className="conversation-copy"><span>{conversation.title}</span><small>{conversation.preview}</small></div>
                    <span className="conversation-time">{conversation.time}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="sidebar-bottom"><button onClick={() => setShowSettings(true)}><Settings size={18} />Settings</button></div>
          </>
        )}
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            {!sidebarOpen && <button className="icon-button" onClick={() => setSidebarOpen(true)}><Menu size={19} /></button>}
            <div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>{activeView === 'chat' ? currentConversation?.title || 'New Chat' : 'Knowledge Base'}</strong></div>
          </div>
          <div className="topbar-actions">
            {loadingWorkspace && <Loader2 size={16} className="spin" />}
            <button className="theme-toggle" onClick={() => setDarkMode((current) => !current)}><span>{darkMode ? 'Dark' : 'Light'}</span><div className={`toggle-track ${darkMode ? 'on' : ''}`}><div className="toggle-thumb" /></div></button>
          </div>
        </header>

        {errorMessage && (
          <div className="workspace-alert"><AlertCircle size={16} /><span>{errorMessage}</span><button onClick={() => setErrorMessage('')}><X size={15} /></button></div>
        )}

        {activeView === 'knowledge' ? (
          <KnowledgeBase
            documents={filteredDocuments}
            totalDocuments={documents.length}
            totalChunks={totalChunks}
            processingCount={processingCount}
            documentSearch={documentSearch}
            setDocumentSearch={setDocumentSearch}
            sourceFilter={sourceFilter}
            setSourceFilter={setSourceFilter}
            documentStatusFilter={documentStatusFilter}
            setDocumentStatusFilter={setDocumentStatusFilter}
            showFilters={showFilters}
            setShowFilters={setShowFilters}
            sources={sources}
            onUpload={openUpload}
            onRetry={retryDocument}
            onDelete={deleteDocument}
            onRename={startRenameDocument}
            onRefresh={() => refreshDocuments().catch((error) => setErrorMessage(error.message))}
          />
        ) : (
          <div className="chat-layout">
            <section className="chat-section">
              <div className="chat-header" style={{ paddingTop: 10, paddingBottom: 10, minHeight: 0 }}>
                <div>
                  <h1 style={{ fontSize: 16, fontWeight: 600, margin: 0, lineHeight: 1.3 }}>{currentConversation?.title || 'New Chat'}</h1>
                </div>
                <div className="chat-header-actions">
                  <button className="secondary-button" style={{ padding: '5px 10px', fontSize: 13 }} onClick={() => setShowSourcePanel((current) => !current)}><Layers3 size={14} />Sources</button>
                  {currentConversation && <div className="chat-menu-wrapper">
                    <button className="icon-button" onClick={() => setShowChatMenu((current) => !current)}><MoreHorizontal size={18} /></button>
                    {showChatMenu && <div className="dropdown-menu"><button onClick={startRename}><Edit3 size={16} />Rename chat</button><button className="danger" onClick={deleteConversation}><Trash2 size={16} />Delete chat</button></div>}
                  </div>}
                </div>
              </div>

              <div className="chat-scroll">
                {messages.length === 0 ? <EmptyChat onSuggestion={setMessageInput} /> : <div className="messages">
                  {messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      expandedCitationIds={expandedCitationIds}
                      toggleCitation={toggleCitation}
                      sourcesOpen={!!expandedSourceLists[message.id]}
                      toggleSourcesOpen={() => toggleSourceList(message.id)}
                      copiedMessageId={copiedMessageId}
                      copyMessage={copyMessage}
                      regenerate={regenerate}
                      likedMessageId={likedMessageId}
                      dislikedMessageId={dislikedMessageId}
                      setLikedMessageId={setLikedMessageId}
                      setDislikedMessageId={setDislikedMessageId}
                    />
                  ))}
                  {isGenerating && <div className="message assistant-message"><div className="message-avatar"><Bot size={17} /></div><div className="message-body"><div className="message-author">RAG Assistant</div><div className="thinking"><span /><span /><span /><p>Searching connected knowledge...</p></div></div></div>}
                </div>}
              </div>

              <div className="composer-area">
                <div className="composer">
                  <textarea value={messageInput} onChange={(event) => setMessageInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage() } }} placeholder="Ask anything about your connected knowledge..." rows={2} />
                  <div className="composer-footer">
                    <div className="composer-tools">
                      <button title="Upload document" onClick={openUpload}><Paperclip size={17} /></button>
                      <button className={groundedMode ? 'active-tool' : ''} onClick={() => setGroundedMode((current) => !current)}><ShieldCheck size={16} />Grounded</button>
                      <button onClick={() => setShowSourceMenu((current) => !current)}><Database size={16} />{selectedSources.length} sources<ChevronDown size={13} /></button>
                    </div>
                    <button className="send-button" onClick={sendMessage} disabled={!messageInput.trim() || isGenerating}>{isGenerating ? <Loader2 size={18} className="spin" /> : <ArrowUp size={19} />}</button>
                  </div>
                </div>

                {showSourceMenu && <div className="source-selector">
                  <div className="selector-header"><div><strong>Knowledge sources</strong><span>Select which sources should be searched.</span></div><button onClick={() => setShowSourceMenu(false)}><X size={16} /></button></div>
                  {sources.map((source) => { const Icon = source.icon; const selected = selectedSources.includes(source.id); return <button key={source.id} className={`source-option ${selected ? 'selected' : ''} ${!source.connected ? 'disabled' : ''}`} onClick={() => toggleSource(source.id)} disabled={!source.connected}><div className="source-option-icon"><Icon size={17} /></div><div className="source-option-copy"><strong>{source.name}</strong><span>{source.connected ? `${source.records ?? 0} records · ${source.type}` : 'Disconnected'}</span></div><div className={`check-box ${selected ? 'checked' : ''}`}>{selected && <Check size={13} />}</div></button> })}
                </div>}
                <div className="composer-note"><ShieldCheck size={13} />{groundedMode ? 'Answers are restricted to retrieved evidence when grounded mode is enabled.' : 'Grounded mode is disabled; the assistant may answer without retrieved evidence.'}</div>
              </div>
            </section>

            {showSourcePanel && <aside className="source-panel">
              <div className="source-panel-header"><div><span className="eyebrow">CONNECTED DATA</span><h2>Knowledge Sources</h2></div><button className="icon-button subtle" onClick={() => setShowSourcePanel(false)}><X size={17} /></button></div>
              <div className="source-summary"><div><span>Connected</span><strong>{sources.filter((source) => source.connected).length}</strong></div><div><span>Total records</span><strong>{documents.length}</strong></div><div><span>Mode</span><strong>{groundedMode ? 'Grounded' : 'Open'}</strong></div></div>
              <div className="source-list">
                {sources.map((source) => {
                  const Icon = source.icon
                  const sourceDocuments = documents.filter((document) => document.source_id === source.id)
                  return (
                    <div className="source-card" key={source.id}>
                      <div className="source-card-top">
                        <div className={`source-large-icon ${source.color}`}><Icon size={19} /></div>
                        <div className={`source-online ${source.connected ? '' : 'source-offline'}`}><span />{source.connected ? 'Connected' : 'Disconnected'}</div>
                      </div>
                      <h3>{source.name}</h3>
                      <p>{source.description}</p>
                      <div className="source-card-meta"><span><strong>{source.records ?? sourceDocuments.length}</strong>documents</span><span><strong>{source.chunks ?? sourceDocuments.reduce((sum, document) => sum + Number(document.chunks || 0), 0)}</strong>chunks</span></div>
                      <div className="source-card-footer"><span>{source.connected ? 'Available for retrieval' : 'Not used for retrieval'}</span><button className="secondary-button" onClick={() => setSourceConnection(source.id, !source.connected)}>{source.connected ? 'Disconnect' : 'Connect'}</button></div>
                    </div>
                  )
                })}
              </div>
            </aside>}
          </div>
        )}
      </main>

      {renamingConversation && <Modal title="Rename conversation" onClose={() => setRenamingConversation(null)}><div className="modal-form"><label>Conversation name</label><input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} autoFocus /><div className="modal-actions"><button className="secondary-button" onClick={() => setRenamingConversation(null)}>Cancel</button><button className="primary-button" onClick={saveRename}>Save changes</button></div></div></Modal>}

      {renamingDocument && <Modal title="Rename document" onClose={() => !renamingDocumentBusy && setRenamingDocument(null)}><div className="modal-form"><label>Document name</label><input value={renameDocumentValue} onChange={(event) => setRenameDocumentValue(event.target.value)} disabled={renamingDocumentBusy} autoFocus /><small>Must end in .pdf or .docx.</small><div className="modal-actions"><button className="secondary-button" onClick={() => setRenamingDocument(null)} disabled={renamingDocumentBusy}>Cancel</button><button className="primary-button" onClick={saveRenameDocument} disabled={!renameDocumentValue.trim() || renamingDocumentBusy}>{renamingDocumentBusy ? <><Loader2 size={15} className="spin" />Saving...</> : 'Save changes'}</button></div></div></Modal>}

      {showUploadModal && <Modal title="Add document" onClose={() => !uploading && setShowUploadModal(false)}><div className="modal-form"><label>Knowledge source</label><select value={uploadSourceId} onChange={(event) => setUploadSourceId(event.target.value)} disabled={uploading}>{sources.filter((source) => source.connected).map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select><label>Document</label><input ref={fileInputRef} type="file" accept=".pdf,.docx" onChange={(event) => setUploadFile(event.target.files?.[0] || null)} disabled={uploading} /><small>{uploadFile ? uploadFile.name : 'PDF and DOCX files are supported.'}</small><div className="modal-actions"><button className="secondary-button" onClick={() => setShowUploadModal(false)} disabled={uploading}>Cancel</button><button className="primary-button" onClick={uploadDocument} disabled={!uploadFile || !uploadSourceId || uploading}>{uploading ? <><Loader2 size={15} className="spin" />Uploading...</> : <><Upload size={15} />Upload</>}</button></div></div></Modal>}

      {showSettings && <Modal title="Workspace settings" onClose={() => setShowSettings(false)}><div className="settings-list"><SettingRow icon={<ShieldCheck size={18} />} title="Grounded responses" description="Restrict responses to retrieved knowledge." control={<button className={`switch ${groundedMode ? 'on' : ''}`} onClick={() => setGroundedMode((current) => !current)}><span /></button>} /><SettingRow icon={<Database size={18} />} title="Vector database" description="PostgreSQL with PGVector." value="Connected" /><SettingRow icon={<Layers3 size={18} />} title="Chunk strategy" description="Fixed-size chunks with overlap." value="800 / 150" /><SettingRow icon={<RefreshCw size={18} />} title="Failed ingestion retry" description="Resume processing from the last checkpoint." value="Supported" /><SettingRow icon={<History size={18} />} title="Version tracking" description="Reuse unchanged units between versions." value="Enabled" /></div></Modal>}
    </div>
  )
}

function MessageBubble({ message, expandedCitationIds, toggleCitation, sourcesOpen, toggleSourcesOpen, copiedMessageId, copyMessage, regenerate, likedMessageId, dislikedMessageId, setLikedMessageId, setDislikedMessageId }) {
  const isUser = message.role === 'user'
  return <div className={`message ${isUser ? 'user-message' : 'assistant-message'}`}>
    {!isUser && <div className="message-avatar"><Bot size={17} /></div>}
    <div className="message-body">
      {!isUser && <div className="message-author">RAG Assistant<span className="verified-badge"><CheckCircle2 size={12} />Grounded</span></div>}
      <div className="message-content">{isUser ? message.content : renderMarkdown(message.content)}</div>
      <div className="message-time">{message.time}</div>
      {!isUser && <>
        <div className="message-actions"><button onClick={() => copyMessage(message)}>{copiedMessageId === message.id ? <Check size={14} /> : <Copy size={14} />}{copiedMessageId === message.id ? 'Copied' : 'Copy'}</button><button onClick={regenerate}><RefreshCw size={14} />Regenerate</button><span className="action-separator" /><button className={likedMessageId === message.id ? 'selected' : ''} onClick={() => { setLikedMessageId(message.id); setDislikedMessageId(null) }}><Check size={14} /></button><button className={dislikedMessageId === message.id ? 'selected' : ''} onClick={() => { setDislikedMessageId(message.id); setLikedMessageId(null) }}><AlertCircle size={14} /></button></div>
        {message.sources?.length > 0 && (
          <div className="citation-section">
            <button
              className="citation-heading"
              onClick={toggleSourcesOpen}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', width: '100%', padding: 0 }}
            >
              <FileSearch size={14} />
              <span>{message.sources.length} sources</span>
              <span className="citation-line" />
              <ChevronDown size={14} className={sourcesOpen ? 'rotate' : ''} />
            </button>
            {sourcesOpen && (
              <div className="citation-list">
                {message.sources.map((source, index) => {
                  const citationId = source.id || `${message.id}-${index}`
                  const expanded = expandedCitationIds[citationId]
                  return (
                    <div className="citation-card" key={citationId}>
                      <button className="citation-main" onClick={() => toggleCitation(citationId)}>
                        <div className="citation-file-icon"><FileText size={18} /></div>
                        <div className="citation-copy"><strong>{source.document}</strong><span>{source.source}{source.page ? ` · Page ${source.page}` : ''} · v${source.version}</span></div>
                        <div className="citation-relevance">{Math.round(Number(source.similarity || 0) * 100)}%</div>
                        <ChevronDown size={15} className={expanded ? 'rotate' : ''} />
                      </button>
                      {expanded && (
                        <div className="citation-expanded">
                          <div className="citation-meta">
                            <span><Database size={13} />{source.source}</span>
                            <span><FileText size={13} />Version {source.version}</span>
                            {source.page && <span><Eye size={13} />Page {source.page}</span>}
                          </div>
                          <p>{source.content || 'Retrieved evidence.'}</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </>}
    </div>
  </div>
}

function EmptyChat({ onSuggestion }) {
  const suggestions = ['Search across all connected sources', 'Summarize a document from the knowledge base', 'Find supporting evidence for a topic', 'Compare information across sources']
  return <div className="empty-chat"><div className="empty-icon"><Sparkles size={25} /></div><h2>How can I help?</h2><p>Ask questions about the connected enterprise knowledge base. Responses can be grounded in retrieved evidence.</p><div className="suggestion-grid">{suggestions.map((suggestion) => <button key={suggestion} onClick={() => onSuggestion(suggestion)}><span>{suggestion}</span><ArrowUp size={15} /></button>)}</div></div>
}

function KnowledgeBase({ documents, totalDocuments, totalChunks, processingCount, documentSearch, setDocumentSearch, sourceFilter, setSourceFilter, documentStatusFilter, setDocumentStatusFilter, showFilters, setShowFilters, sources, onUpload, onRetry, onDelete, onRename, onRefresh }) {
  const filtersActive = sourceFilter !== 'All' || documentStatusFilter !== 'All'
  return <section className="knowledge-page"><div className="knowledge-header"><div><div className="eyebrow"><span className="status-dot" />KNOWLEDGE MANAGEMENT</div><h1>Knowledge Base</h1><p>Manage documents, versions and ingestion across the connected sources.</p></div><button className="primary-button" onClick={onUpload}><Upload size={16} />Add document</button></div>
    <div className="knowledge-stats"><StatCard icon={<Database size={18} />} label="Connected sources" value={sources.filter((source) => source.connected).length} detail="Available" /><StatCard icon={<File size={18} />} label="Documents" value={totalDocuments} detail={totalDocuments ? 'Stored' : 'No documents'} /><StatCard icon={<Layers3 size={18} />} label="Indexed chunks" value={totalChunks} detail="PGVector" /><StatCard icon={<Zap size={18} />} label="Processing" value={processingCount} detail={processingCount ? 'Active' : 'No active jobs'} /></div>
    <div className="knowledge-toolbar"><div className="document-search"><Search size={17} /><input value={documentSearch} onChange={(event) => setDocumentSearch(event.target.value)} placeholder="Search documents..." /></div><button className={`secondary-button ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters((current) => !current)}><Filter size={16} />Filters{filtersActive && <span className="filter-indicator" />}</button><button className="secondary-button" onClick={onRefresh}><RefreshCw size={16} />Refresh</button></div>
    {showFilters && <div className="filter-panel"><div><label>Source</label><select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}><option>All</option>{sources.map((source) => <option key={source.id}>{source.name}</option>)}</select></div><div><label>Status</label><select value={documentStatusFilter} onChange={(event) => setDocumentStatusFilter(event.target.value)}><option>All</option><option>Indexed</option><option>Processing</option><option>Failed</option></select></div><button className="text-button" onClick={() => { setSourceFilter('All'); setDocumentStatusFilter('All') }}>Clear filters</button></div>}
    <div className="document-table-card"><div className="table-header"><div><h2>Documents</h2><span>{documents.length} documents found</span></div></div>{documents.length === 0 ? <div className="empty-knowledge-state"><div className="empty-icon"><FileSearch size={24} /></div><h3>No documents yet</h3><p>Upload a PDF or DOCX into one of the three knowledge sources to start ingestion.</p></div> : <div className="document-table"><div className="document-table-head"><span>Document</span><span>Source</span><span>Version</span><span>Chunks</span><span>Status</span><span>Updated</span><span /></div>{documents.map((document) => { const processing = ['processing', 'queued'].includes(document.status) || ['processing', 'queued'].includes(document.job_status); const failed = document.status === 'error' || document.job_status === 'failed'; return <div className="document-row" key={document.id}><div className="document-name"><FileText size={17} /><div><strong>{document.name}</strong><small>{document.type}</small></div></div><span>{document.source}</span><span>v{document.version || 0}</span><span>{document.chunks || 0}</span><span className={failed ? 'status-failed' : processing ? 'status-processing' : 'status-ready'}>{failed ? 'Failed' : processing ? `${document.processed_units || 0}/${document.total_units || 0}` : 'Indexed'}</span><span>{formatDate(document.updated_at)}</span><div className="document-actions">{failed && <button title="Retry ingestion" onClick={() => onRetry(document.id)}><RefreshCw size={15} /></button>}<button title="Rename document" onClick={() => onRename(document)}><Edit3 size={15} /></button><button title="Delete document" onClick={() => onDelete(document)}><Trash2 size={15} /></button></div></div> })}</div>}</div>
  </section>
}

function StatCard({ icon, label, value, detail }) { return <div className="stat-card"><div className="stat-icon">{icon}</div><div className="stat-copy"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></div> }
function SettingRow({ icon, title, description, control, value }) { return <div className="setting-row"><div className="setting-icon">{icon}</div><div className="setting-copy"><strong>{title}</strong><span>{description}</span></div>{control || <span className="setting-value">{value}</span>}</div> }
function Modal({ title, onClose, children }) { return <div className="modal-backdrop" onClick={onClose}><div className="modal" onClick={(event) => event.stopPropagation()}><div className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={onClose}><X size={18} /></button></div><div className="modal-content">{children}</div></div></div> }

export default App