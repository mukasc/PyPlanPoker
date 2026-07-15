import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { Toaster, toast } from "sonner";
import {
  Users,
  Home,
  Trash2,
  GitMerge,
  ShieldAlert,
  Search,
  RefreshCw,
  X,
  ExternalLink,
  Info
} from "lucide-react";

export default function AdminPanel() {
  const navigate = useNavigate();
  
  // Abas: "users" | "rooms"
  const [activeTab, setActiveTab] = useState("users");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Dados
  const [users, setUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  
  // Filtros / Busca
  const [searchUser, setSearchUser] = useState("");
  const [searchRoom, setSearchRoom] = useState("");
  
  // Estado de Mesclagem
  const [targetUserId, setTargetUserId] = useState("");
  const [selectedSources, setSelectedSources] = useState([]);
  const [isMerging, setIsMerging] = useState(false);
  
  // Modais de Confirmação
  const [deleteTargetUser, setDeleteTargetUser] = useState(null);
  const [userRelationsCheck, setUserRelationsCheck] = useState(null);
  const [isCheckingRelations, setIsCheckingRelations] = useState(false);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  
  const [deleteTargetRoom, setDeleteTargetRoom] = useState(null);
  const [isDeletingRoom, setIsDeletingRoom] = useState(false);

  // Carregar Dados
  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    
    try {
      const [usersRes, roomsRes] = await Promise.all([
        api.get("/api/admin/users"),
        api.get("/api/admin/rooms")
      ]);
      setUsers(usersRes.data);
      setRooms(roomsRes.data);
    } catch (error) {
      console.error("Erro ao buscar dados administrativos:", error);
      toast.error("Falha ao carregar os dados administrativos. Verifique o servidor.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- FUNÇÕES DE USUÁRIOS ---

  // Iniciar fluxo de exclusão de usuário (verifica dependências primeiro)
  const handleInitiateDeleteUser = async (user) => {
    setDeleteTargetUser(user);
    setIsCheckingRelations(true);
    try {
      const res = await api.get(`/api/admin/users/${user.id}/check`);
      setUserRelationsCheck(res.data);
    } catch (error) {
      console.error("Erro ao verificar dependências:", error);
      toast.error("Não foi possível verificar as relações do usuário.");
    } finally {
      setIsCheckingRelations(false);
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!deleteTargetUser) return;
    setIsDeletingUser(true);
    try {
      await api.delete(`/api/admin/users/${deleteTargetUser.id}?confirm=true`);
      toast.success(`Usuário ${deleteTargetUser.name} excluído com sucesso!`);
      // Limpa seleções se o usuário excluído estivesse selecionado para mesclagem
      if (targetUserId === deleteTargetUser.id) setTargetUserId("");
      setSelectedSources(prev => prev.filter(id => id !== deleteTargetUser.id));
      
      setDeleteTargetUser(null);
      setUserRelationsCheck(null);
      fetchData();
    } catch (error) {
      console.error("Erro ao deletar usuário:", error);
      toast.error("Erro ao excluir usuário.");
    } finally {
      setIsDeletingUser(false);
    }
  };

  const handleToggleSourceUser = (userId) => {
    if (selectedSources.includes(userId)) {
      setSelectedSources(prev => prev.filter(id => id !== userId));
    } else {
      setSelectedSources(prev => [...prev, userId]);
    }
  };

  const handleMergeUsers = async () => {
    if (!targetUserId) {
      toast.error("Selecione um usuário de destino para mesclar.");
      return;
    }
    if (selectedSources.length === 0) {
      toast.error("Selecione pelo menos um usuário de origem (Guest) para mesclar.");
      return;
    }
    
    setIsMerging(true);
    try {
      await api.post("/api/admin/users/merge", {
        target_id: targetUserId,
        source_ids: selectedSources
      });
      
      const targetUser = users.find(u => u.id === targetUserId);
      toast.success(`Mesclagem realizada! ${selectedSources.length} usuários unificados em ${targetUser?.name}.`);
      
      // Limpar seleção
      setSelectedSources([]);
      fetchData();
    } catch (error) {
      console.error("Erro ao mesclar usuários:", error);
      toast.error("Erro ao mesclar usuários.");
    } finally {
      setIsMerging(false);
    }
  };

  // --- FUNÇÕES DE SALAS ---

  const handleConfirmDeleteRoom = async () => {
    if (!deleteTargetRoom) return;
    setIsDeletingRoom(true);
    try {
      await api.delete(`/api/admin/rooms/${deleteTargetRoom.id}`);
      toast.success(`Sala ${deleteTargetRoom.name} (${deleteTargetRoom.id}) excluída com sucesso!`);
      setDeleteTargetRoom(null);
      fetchData();
    } catch (error) {
      console.error("Erro ao excluir sala:", error);
      toast.error("Erro ao excluir sala.");
    } finally {
      setIsDeletingRoom(false);
    }
  };

  // --- FILTROS ---
  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchUser.toLowerCase()) || 
    user.id.toLowerCase().includes(searchUser.toLowerCase()) ||
    (user.email && user.email.toLowerCase().includes(searchUser.toLowerCase()))
  );

  const filteredRooms = rooms.filter(room => 
    room.name.toLowerCase().includes(searchRoom.toLowerCase()) || 
    room.id.toLowerCase().includes(searchRoom.toLowerCase())
  );

  // Usuários válidos para Destino de Mesclagem (Google ou Guest Principal)
  const targetUserOptions = users.filter(u => !selectedSources.includes(u.id));
  
  // Usuários válidos para Origem (Normalmente Guests ou qualquer usuário diferente do destino)
  const sourceUserOptions = users.filter(u => u.id !== targetUserId && u.type === "Guest");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased">
      <Toaster position="top-center" theme="dark" richColors />
      
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white shadow-lg shadow-indigo-500/20">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                Painel Administrativo
              </h1>
              <p className="text-xs text-slate-400">PyPlanPoker Truth & State Engine</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing || loading}
              className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition disabled:opacity-50"
              title="Recarregar dados"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? "animate-spin text-indigo-400" : ""}`} />
            </button>
            <button
              onClick={() => navigate("/")}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg transition text-sm font-medium flex items-center gap-2"
            >
              Voltar ao Poker
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Tabs Selectors */}
        <div className="flex border-b border-slate-800 mb-8 gap-6">
          <button
            onClick={() => setActiveTab("users")}
            className={`pb-4 px-2 text-sm font-semibold tracking-wide flex items-center gap-2 transition-all border-b-2 relative -bottom-[2px] ${
              activeTab === "users"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Users className="w-4 h-4" />
            Usuários ({users.length})
          </button>
          
          <button
            onClick={() => setActiveTab("rooms")}
            className={`pb-4 px-2 text-sm font-semibold tracking-wide flex items-center gap-2 transition-all border-b-2 relative -bottom-[2px] ${
              activeTab === "rooms"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Home className="w-4 h-4" />
            Salas ({rooms.length})
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <RefreshCw className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
            <p className="text-sm font-mono">Buscando banco de dados...</p>
          </div>
        ) : (
          <>
            {/* --- TAB DE USUÁRIOS --- */}
            {activeTab === "users" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Lista de Usuários */}
                <div className="lg:col-span-8 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                    <h3 className="text-lg font-bold">Gerenciamento de Usuários</h3>
                    <div className="relative w-full sm:w-72">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Buscar por nome, ID ou email..."
                        value={searchUser}
                        onChange={(e) => setSearchUser(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 text-xs font-mono tracking-wider">
                          <th className="pb-3 pl-2">Status / Tipo</th>
                          <th className="pb-3">Usuário</th>
                          <th className="pb-3 text-center">Salas (Dono)</th>
                          <th className="pb-3 text-center">Votos</th>
                          <th className="pb-3 text-center">Participações</th>
                          <th className="pb-3 pr-2 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {filteredUsers.length === 0 ? (
                          <tr>
                            <td colSpan="6" className="py-8 text-center text-slate-500 text-sm">
                              Nenhum usuário encontrado.
                            </td>
                          </tr>
                        ) : (
                          filteredUsers.map((user) => (
                            <tr key={user.id} className="group hover:bg-slate-800/20 transition-all">
                              <td className="py-3.5 pl-2">
                                <div className="flex items-center gap-2">
                                  <span 
                                    className={`w-2.5 h-2.5 rounded-full ring-4 ${
                                      user.is_online 
                                        ? "bg-emerald-500 ring-emerald-500/20" 
                                        : "bg-slate-600 ring-slate-800"
                                    }`}
                                    title={user.is_online ? "Online" : "Offline"}
                                  />
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                    user.type === "Google"
                                      ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                                      : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                  }`}>
                                    {user.type}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3.5">
                                <div className="flex items-center gap-3">
                                  {user.picture ? (
                                    <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full border border-slate-700" />
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300">
                                      {user.name.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                  <div>
                                    <div className="font-semibold text-slate-200 text-sm group-hover:text-white transition">
                                      {user.name}
                                    </div>
                                    <div className="text-xs text-slate-500 font-mono truncate max-w-[200px]" title={user.id}>
                                      {user.email || user.id}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3.5 text-center text-sm font-mono text-slate-300">
                                {user.rooms_owned}
                              </td>
                              <td className="py-3.5 text-center text-sm font-mono text-slate-300">
                                {user.votes_cast}
                              </td>
                              <td className="py-3.5 text-center text-sm font-mono text-slate-300">
                                {user.rooms_participated}
                              </td>
                              <td className="py-3.5 pr-2 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {user.type === "Guest" && (
                                    <button
                                      onClick={() => handleToggleSourceUser(user.id)}
                                      disabled={targetUserId === user.id}
                                      className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition ${
                                        selectedSources.includes(user.id)
                                          ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                          : "bg-slate-950 text-slate-400 border-slate-800 hover:text-amber-400 hover:border-amber-500/30 disabled:opacity-30"
                                      }`}
                                    >
                                      {selectedSources.includes(user.id) ? "Selecionado" : "Mesclar"}
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleInitiateDeleteUser(user)}
                                    className="p-1.5 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded-lg transition"
                                    title="Excluir Usuário"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Painel de Mesclagem */}
                <div className="lg:col-span-4 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-sm sticky top-24">
                  <div className="flex items-center gap-2.5 mb-4 text-indigo-400">
                    <GitMerge className="w-5 h-5" />
                    <h3 className="text-lg font-bold text-white">Mesclar Usuários</h3>
                  </div>
                  
                  <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                    Unifique múltiplos usuários Guest temporários em um usuário destino definitivo (Google ou outro Guest). Isso mudará o ID nas relações de salas criadas, votos e participações.
                  </p>

                  <div className="space-y-5">
                    {/* Usuário Destino */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                        1. Usuário de Destino (Receberá os dados)
                      </label>
                      <select
                        value={targetUserId}
                        onChange={(e) => setTargetUserId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                      >
                        <option value="">Selecione o usuário destino...</option>
                        {targetUserOptions.map(u => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.type} - {u.email || u.id.slice(0, 12)})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Origens Selecionadas */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                        <span>2. Origens Selecionadas ({selectedSources.length})</span>
                        {selectedSources.length > 0 && (
                          <button 
                            onClick={() => setSelectedSources([])}
                            className="text-[10px] text-red-400 hover:underline"
                          >
                            Limpar
                          </button>
                        )}
                      </label>
                      
                      {selectedSources.length === 0 ? (
                        <div className="border border-dashed border-slate-800 rounded-xl p-4 text-center text-xs text-slate-500 leading-normal">
                          Clique em <span className="text-amber-500 font-semibold">"Mesclar"</span> na tabela ao lado para selecionar os Guests que deseja unificar.
                        </div>
                      ) : (
                        <div className="bg-slate-950 border border-slate-800 rounded-xl max-h-48 overflow-y-auto divide-y divide-slate-900">
                          {selectedSources.map(id => {
                            const u = users.find(user => user.id === id);
                            return (
                              <div key={id} className="p-2.5 flex items-center justify-between text-xs">
                                <span className="font-semibold text-slate-300 truncate max-w-[180px]">
                                  {u?.name || "Desconhecido"}
                                </span>
                                <span className="font-mono text-slate-500 text-[10px]">
                                  {id.slice(0, 14)}...
                                </span>
                                <button
                                  onClick={() => handleToggleSourceUser(id)}
                                  className="text-slate-500 hover:text-slate-200 transition"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Botão de Ação */}
                    <button
                      onClick={handleMergeUsers}
                      disabled={isMerging || !targetUserId || selectedSources.length === 0}
                      className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl font-semibold shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 disabled:opacity-50 disabled:shadow-none transition flex items-center justify-center gap-2 text-sm mt-2"
                    >
                      {isMerging ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Mesclando...
                        </>
                      ) : (
                        <>
                          <GitMerge className="w-4 h-4" />
                          Confirmar Unificação
                        </>
                      )}
                    </button>
                  </div>
                </div>

              </div>
            )}

            {/* --- TAB DE SALAS --- */}
            {activeTab === "rooms" && (
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                  <h3 className="text-lg font-bold">Salas Ativas</h3>
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Buscar por código ou nome..."
                      value={searchRoom}
                      onChange={(e) => setSearchRoom(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-xs font-mono tracking-wider">
                        <th className="pb-3 pl-2">Código</th>
                        <th className="pb-3">Nome da Sala</th>
                        <th className="pb-3">Dono (ID)</th>
                        <th className="pb-3 text-center">Data de Criação</th>
                        <th className="pb-3 text-center">Deck</th>
                        <th className="pb-3 text-center">Tarefas</th>
                        <th className="pb-3 text-center">Jogadores (Online)</th>
                        <th className="pb-3 pr-2 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {filteredRooms.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="py-8 text-center text-slate-500 text-sm">
                            Nenhuma sala encontrada.
                          </td>
                        </tr>
                      ) : (
                        filteredRooms.map((room) => {
                          const ownerUser = users.find(u => u.id === room.owner_id);
                          return (
                            <tr key={room.id} className="group hover:bg-slate-800/20 transition-all">
                              <td className="py-3.5 pl-2 font-mono font-bold text-indigo-400">
                                {room.id}
                              </td>
                              <td className="py-3.5 font-semibold text-slate-200">
                                {room.name}
                              </td>
                              <td className="py-3.5">
                                <div className="text-sm text-slate-300">
                                  {ownerUser ? ownerUser.name : "Desconhecido"}
                                </div>
                                <div className="text-xs text-slate-500 font-mono">
                                  {room.owner_id ? `${room.owner_id.slice(0, 14)}...` : "Nenhum"}
                                </div>
                              </td>
                              <td className="py-3.5 text-center text-xs text-slate-400">
                                {room.created_at ? new Date(room.created_at).toLocaleString("pt-BR") : "-"}
                              </td>
                              <td className="py-3.5 text-center">
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                                  {room.deck_type}
                                </span>
                              </td>
                              <td className="py-3.5 text-center text-sm font-mono text-slate-300">
                                {room.tasks_count}
                              </td>
                              <td className="py-3.5 text-center text-sm font-mono text-slate-300">
                                {room.total_users_count} <span className="text-emerald-500 text-xs">({room.active_users_count})</span>
                              </td>
                              <td className="py-3.5 pr-2 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <a
                                    href={`/room/${room.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 hover:bg-slate-800 text-slate-500 hover:text-indigo-400 rounded-lg transition"
                                    title="Ir para a Sala"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </a>
                                  <button
                                    onClick={() => setDeleteTargetRoom(room)}
                                    className="p-1.5 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded-lg transition"
                                    title="Excluir Sala"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* --- MODAIS DE CONFIRMAÇÃO --- */}

      {/* Modal Deletar Usuário (Dinamizado conforme dependências) */}
      {deleteTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setDeleteTargetUser(null)} />
          
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 relative z-10 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 bg-red-500/10 text-red-400 rounded-xl">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Confirmar Exclusão de Usuário</h4>
                <p className="text-sm text-slate-400 mt-1">
                  Você está prestes a excluir o usuário <span className="font-bold text-slate-200">{deleteTargetUser.name}</span>.
                </p>
              </div>
            </div>

            {isCheckingRelations ? (
              <div className="py-4 flex items-center justify-center gap-2 text-slate-500 text-sm">
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                Verificando relações...
              </div>
            ) : (
              userRelationsCheck && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 my-4 space-y-2 text-xs">
                  <div className="font-semibold text-slate-300 flex items-center gap-1.5 mb-1 text-amber-400">
                    <Info className="w-3.5 h-3.5" />
                    Impacto da Exclusão:
                  </div>
                  <div className="grid grid-cols-2 gap-y-1 text-slate-400">
                    <span>Salas Criadas (Owner):</span>
                    <span className={`font-mono text-right ${userRelationsCheck.owned_rooms > 0 ? "text-red-400 font-bold" : "text-slate-300"}`}>
                      {userRelationsCheck.owned_rooms}
                    </span>
                    <span>Votos Cadastrados:</span>
                    <span className="font-mono text-slate-300 text-right">{userRelationsCheck.votes}</span>
                    <span>Salas Participadas:</span>
                    <span className="font-mono text-slate-300 text-right">{userRelationsCheck.memberships}</span>
                  </div>
                  {userRelationsCheck.has_relations && (
                    <div className="text-[10px] text-red-400/90 leading-relaxed border-t border-slate-900 pt-2 mt-2">
                      ⚠️ A exclusão removerá permanentemente as salas pertencentes a ele, bem como seus votos e participações ativas.
                    </div>
                  )}
                </div>
              )
            )}

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => { setDeleteTargetUser(null); setUserRelationsCheck(null); }}
                className="px-4 py-2 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-sm transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDeleteUser}
                disabled={isDeletingUser || isCheckingRelations}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-red-600/10 hover:shadow-red-600/20 transition disabled:opacity-50"
              >
                {isDeletingUser ? "Excluindo..." : "Confirmar Exclusão"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Deletar Sala */}
      {deleteTargetRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setDeleteTargetRoom(null)} />
          
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 relative z-10 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 bg-red-500/10 text-red-400 rounded-xl">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Confirmar Exclusão de Sala</h4>
                <p className="text-sm text-slate-400 mt-1">
                  Você está excluindo a sala <span className="font-bold text-slate-200">{deleteTargetRoom.name} ({deleteTargetRoom.id})</span>.
                </p>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 my-4 text-xs text-slate-400 space-y-1 leading-relaxed">
              <p>Esta operação apagará:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Configurações e registros da sala.</li>
                <li>Todas as tarefas e estimativas cadastradas.</li>
                <li>Todos os votos e histórico.</li>
              </ul>
              <p className="text-red-400 font-semibold mt-2">
                ⚠️ Jogadores ativos no momento serão desconectados da sala instantaneamente.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setDeleteTargetRoom(null)}
                className="px-4 py-2 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-sm transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDeleteRoom}
                disabled={isDeletingRoom}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-red-600/10 hover:shadow-red-600/20 transition disabled:opacity-50"
              >
                {isDeletingRoom ? "Excluindo..." : "Excluir Sala"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
