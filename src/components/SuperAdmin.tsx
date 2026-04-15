import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Plus,
  Users,
  Trash2,
  Edit,
  ArrowLeft,
  Search,
  Shield,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ApiConfigPanel from './admin/ApiConfigPanel';
import DataSyncPanel from './admin/DataSyncPanel';
import {
  createEstablishment,
  updateEstablishment,
  deleteEstablishment,
  listAllEstablishments,
  addEstablishmentMember,
  removeEstablishmentMember,
  updateMemberRole,
  listEstablishmentMembers,
} from '../lib/firestoreEstablishments';
import { getAllUsers, getUserDisplayNames } from '../lib/firestore';
import type {
  Establishment,
  EstablishmentCreateData,
  EstablishmentType,
  EstablishmentCycle,
  EstablishmentRole,
  EstablishmentMember,
} from '../types/establishment';

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  role: string;
  status: string;
  createdAt: unknown;
  deleted?: boolean;
  deletedAt?: unknown;
  establishments?: string[];
  currentEstablishment?: string;
}

const TYPE_LABELS: Record<EstablishmentType, string> = {
  college: 'Collège',
  lycee: 'Lycée',
  'college-lycee': 'Collège-Lycée',
};

const CYCLE_LABELS: Record<EstablishmentCycle, string> = {
  college: 'Collège',
  lycee: 'Lycée',
  both: 'Les deux',
};

const ROLE_LABELS: Record<EstablishmentRole, string> = {
  admin: 'Administrateur',
  user: 'Utilisateur',
};

interface EstablishmentFormData {
  name: string;
  code: string;
  type: EstablishmentType;
  cycle: EstablishmentCycle;
  address: string;
  city: string;
  region: string;
}

const emptyForm: EstablishmentFormData = {
  name: '',
  code: '',
  type: 'college',
  cycle: 'college',
  address: '',
  city: '',
  region: '',
};

export default function SuperAdmin() {
  const { user, isSuperAdmin } = useAuth();

  // --- data state ---
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [members, setMembers] = useState<EstablishmentMember[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);

  // --- ui state ---
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEstablishment, setSelectedEstablishment] = useState<Establishment | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);

  // --- modals ---
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEstablishment, setEditingEstablishment] = useState<Establishment | null>(null);
  const [formData, setFormData] = useState<EstablishmentFormData>(emptyForm);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberRole, setMemberRole] = useState<EstablishmentRole>('user');
  const [addingMember, setAddingMember] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // member counts per establishment
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  // owner names per establishment
  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({});

  // --- data loading ---
  const loadEstablishments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await listAllEstablishments();
      setEstablishments(list);

      // load member counts in parallel
      const counts: Record<string, number> = {};
      await Promise.all(
        list.map(async (est) => {
          try {
            const m = await listEstablishmentMembers(est.id);
            counts[est.id] = m.length;
          } catch {
            counts[est.id] = 0;
          }
        })
      );
      setMemberCounts(counts);

      // load owner display names
      const creatorUids = [...new Set(list.map(e => e.createdBy).filter(Boolean))];
      if (creatorUids.length > 0) {
        const names = await getUserDisplayNames(creatorUids);
        setOwnerNames(names);
      }
    } catch (err) {
      setError('Erreur lors du chargement des établissements.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMembers = useCallback(async (estId: string) => {
    try {
      setMembersLoading(true);
      const m = await listEstablishmentMembers(estId);
      setMembers(m);
    } catch (err) {
      console.error(err);
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin) {
      loadEstablishments();
    }
  }, [isSuperAdmin, loadEstablishments]);

  useEffect(() => {
    if (selectedEstablishment) {
      loadMembers(selectedEstablishment.id);
    }
  }, [selectedEstablishment, loadMembers]);

  // --- access guard ---
  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f9f9fd' }}>
        <div className="card-cassie p-8 text-center max-w-sm mx-4">
          <div className="inline-flex p-4 rounded-full mb-4" style={{ background: '#fce8ea' }}>
            <Shield className="w-8 h-8" style={{ color: '#dc3545' }} />
          </div>
          <h2 className="text-lg font-semibold mb-2" style={{ color: '#06072d' }}>Accès refusé</h2>
          <p className="text-sm mb-4" style={{ color: '#8392a5' }}>
            Vous n'avez pas les droits nécessaires pour accéder à cette page.
          </p>
          <Link
            to="/sessions"
            className="inline-flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold text-white"
            style={{ background: '#5556fd' }}
          >
            <ArrowLeft className="w-4 h-4" /> Retour
          </Link>
        </div>
      </div>
    );
  }

  // --- handlers ---

  const openCreateModal = () => {
    setFormData(emptyForm);
    setEditingEstablishment(null);
    setFormError(null);
    setShowCreateModal(true);
  };

  const openEditModal = (est: Establishment) => {
    setFormData({
      name: est.name,
      code: est.code || '',
      type: est.type,
      cycle: est.cycle,
      address: est.address || '',
      city: est.city || '',
      region: est.region || '',
    });
    setEditingEstablishment(est);
    setFormError(null);
    setShowCreateModal(true);
  };

  const closeFormModal = () => {
    setShowCreateModal(false);
    setEditingEstablishment(null);
    setFormData(emptyForm);
    setFormError(null);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Le nom est requis.');
      return;
    }

    // Build data without undefined values (Firestore rejects undefined)
    const data: Record<string, unknown> = {
      name: formData.name.trim(),
      type: formData.type,
      cycle: formData.cycle,
    };
    if (formData.code.trim()) data.code = formData.code.trim();
    if (formData.address.trim()) data.address = formData.address.trim();
    if (formData.city.trim()) data.city = formData.city.trim();
    if (formData.region.trim()) data.region = formData.region.trim();

    try {
      setFormSaving(true);
      setFormError(null);
      if (editingEstablishment) {
        await updateEstablishment(editingEstablishment.id, data);
        setSelectedEstablishment({ ...editingEstablishment, ...data } as Establishment);
      } else {
        await createEstablishment(
          { ...data, createdBy: user!.uid } as EstablishmentCreateData,
          user!.uid,
          user!.email || '',
          user!.displayName || ''
        );
      }
      closeFormModal();
      await loadEstablishments();
    } catch (err) {
      console.error(err);
      setFormError("Erreur lors de l'enregistrement.");
    } finally {
      setFormSaving(false);
    }
  };

  const handleDeleteEstablishment = async () => {
    if (!selectedEstablishment) return;
    try {
      setDeleting(true);
      await deleteEstablishment(selectedEstablishment.id);
      setSelectedEstablishment(null);
      setShowDeleteConfirm(false);
      await loadEstablishments();
    } catch (err) {
      console.error(err);
      setError("Erreur lors de la suppression de l'établissement.");
    } finally {
      setDeleting(false);
    }
  };

  const openAddMemberModal = async () => {
    setMemberSearch('');
    setMemberRole('user');
    setShowAddMemberModal(true);
    try {
      const users = await getAllUsers();
      setAllUsers(users);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredUsers = allUsers.filter((u) => {
    const alreadyMember = members.some((m) => m.uid === u.uid);
    if (alreadyMember) return false;
    if (!memberSearch.trim()) return false;
    const q = memberSearch.toLowerCase();
    return (
      u.email?.toLowerCase().includes(q) ||
      u.displayName?.toLowerCase().includes(q)
    );
  });

  const handleAddMember = async (userProfile: UserProfile) => {
    if (!selectedEstablishment) return;
    try {
      setAddingMember(true);
      await addEstablishmentMember(selectedEstablishment.id, {
        uid: userProfile.uid,
        email: userProfile.email,
        displayName: userProfile.displayName,
        role: memberRole,
      });
      setShowAddMemberModal(false);
      await loadMembers(selectedEstablishment.id);
      // update count
      setMemberCounts((prev) => ({
        ...prev,
        [selectedEstablishment.id]: (prev[selectedEstablishment.id] || 0) + 1,
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (uid: string) => {
    if (!selectedEstablishment) return;
    try {
      await removeEstablishmentMember(selectedEstablishment.id, uid);
      await loadMembers(selectedEstablishment.id);
      setMemberCounts((prev) => ({
        ...prev,
        [selectedEstablishment.id]: Math.max(0, (prev[selectedEstablishment.id] || 1) - 1),
      }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleRoleChange = async (uid: string, role: EstablishmentRole) => {
    if (!selectedEstablishment) return;
    try {
      await updateMemberRole(selectedEstablishment.id, uid, role);
      await loadMembers(selectedEstablishment.id);
    } catch (err) {
      console.error(err);
    }
  };

  // --- render helpers ---

  const renderFormInput = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    required = false
  ) => (
    <div>
      <label className="block text-sm font-medium mb-1" style={{ color: '#373857' }}>
        {label} {required && <span style={{ color: '#dc3545' }}>*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full text-sm border rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#5556fd]"
        style={{ borderColor: '#e6e7ef', color: '#373857' }}
      />
    </div>
  );

  const renderFormSelect = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    options: { value: string; label: string }[]
  ) => (
    <div>
      <label className="block text-sm font-medium mb-1" style={{ color: '#373857' }}>
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm border rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#5556fd]"
        style={{ borderColor: '#e6e7ef', color: '#373857' }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );

  // --- detail view ---
  if (selectedEstablishment) {
    return (
      <div className="min-h-screen" style={{ background: '#f9f9fd' }}>
        <header className="bg-white border-b" style={{ borderColor: '#e6e7ef' }}>
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedEstablishment(null)}
                className="p-1.5 rounded hover:bg-[#f0f0ff] transition-colors"
                style={{ color: '#5556fd' }}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg font-semibold" style={{ color: '#06072d' }}>
                  {selectedEstablishment.name}
                </h1>
                <p className="text-xs" style={{ color: '#8392a5' }}>
                  {TYPE_LABELS[selectedEstablishment.type]}
                  {selectedEstablishment.city && ` · ${selectedEstablishment.city}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => openEditModal(selectedEstablishment)}
                className="flex items-center gap-2 px-3 py-2 rounded text-sm font-medium border hover:bg-[#f0f0ff] transition-colors"
                style={{ borderColor: '#e6e7ef', color: '#5556fd' }}
              >
                <Edit className="w-4 h-4" /> Modifier
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 px-3 py-2 rounded text-sm font-medium border hover:bg-[#fce8ea] transition-colors"
                style={{ borderColor: '#e6e7ef', color: '#dc3545' }}
              >
                <Trash2 className="w-4 h-4" /> Supprimer
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-8">
          {/* Establishment info card */}
          <div className="card-cassie p-5 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InfoField label="Nom" value={selectedEstablishment.name} />
              <InfoField label="Code" value={selectedEstablishment.code || '—'} />
              <InfoField label="Type" value={TYPE_LABELS[selectedEstablishment.type]} />
              <InfoField label="Cycle" value={CYCLE_LABELS[selectedEstablishment.cycle]} />
              <InfoField label="Ville" value={selectedEstablishment.city || '—'} />
              <InfoField label="Région" value={selectedEstablishment.region || '—'} />
              {selectedEstablishment.address && (
                <div className="md:col-span-3">
                  <InfoField label="Adresse" value={selectedEstablishment.address} />
                </div>
              )}
            </div>
          </div>

          {/* Members section */}
          <div className="card-cassie overflow-hidden">
            <div
              className="px-5 py-4 border-b flex items-center justify-between"
              style={{ borderColor: '#e6e7ef' }}
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" style={{ color: '#5556fd' }} />
                <h3 className="font-medium text-sm" style={{ color: '#06072d' }}>
                  Membres ({members.length})
                </h3>
              </div>
              <button
                onClick={openAddMemberModal}
                className="flex items-center gap-2 px-3 py-1.5 rounded text-sm font-semibold text-white"
                style={{ background: '#5556fd' }}
              >
                <Plus className="w-4 h-4" /> Ajouter un membre
              </button>
            </div>

            <div className="p-5">
              {membersLoading ? (
                <div className="text-center py-8">
                  <div
                    className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-2"
                    style={{ borderColor: '#5556fd', borderTopColor: 'transparent' }}
                  />
                  <p className="text-sm" style={{ color: '#8392a5' }}>
                    Chargement...
                  </p>
                </div>
              ) : members.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-8 h-8 mx-auto mb-2" style={{ color: '#8392a5' }} />
                  <p className="text-sm" style={{ color: '#8392a5' }}>
                    Aucun membre dans cet établissement.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {members.map((member) => (
                    <div
                      key={member.uid}
                      className="flex items-center justify-between px-4 py-3 rounded border"
                      style={{ borderColor: '#e6e7ef' }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white"
                          style={{ background: member.role === 'admin' ? '#5556fd' : '#8392a5' }}
                        >
                          {member.displayName?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="text-sm font-medium" style={{ color: '#06072d' }}>
                            {member.displayName}
                          </p>
                          <p className="text-xs" style={{ color: '#8392a5' }}>
                            {member.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <select
                          value={member.role}
                          onChange={(e) =>
                            handleRoleChange(member.uid, e.target.value as EstablishmentRole)
                          }
                          className="text-xs border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#5556fd]"
                          style={{ borderColor: '#e6e7ef', color: '#575d78' }}
                        >
                          <option value="admin">{ROLE_LABELS.admin}</option>
                          <option value="user">{ROLE_LABELS.user}</option>
                        </select>
                        <button
                          onClick={() => handleRemoveMember(member.uid)}
                          className="p-1.5 rounded hover:bg-[#fce8ea] transition-colors"
                          style={{ color: '#dc3545' }}
                          title="Retirer ce membre"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Data sync panel */}
          <DataSyncPanel
            establishmentName={selectedEstablishment.name}
            establishmentCode={selectedEstablishment.code}
          />
        </main>

        {/* Delete confirmation modal */}
        {showDeleteConfirm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <div className="card-cassie w-full max-w-sm p-6 mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="text-center">
                <div className="inline-flex p-3 rounded-full mb-4" style={{ background: '#fce8ea' }}>
                  <Trash2 className="w-6 h-6" style={{ color: '#dc3545' }} />
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: '#06072d' }}>
                  Confirmer la suppression
                </h3>
                <p className="text-sm mb-6" style={{ color: '#8392a5' }}>
                  Êtes-vous sûr de vouloir supprimer l'établissement{' '}
                  <strong style={{ color: '#06072d' }}>{selectedEstablishment.name}</strong> ?
                  Cette action est irréversible.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2 rounded text-sm font-medium border"
                    style={{ borderColor: '#e6e7ef', color: '#575d78' }}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleDeleteEstablishment}
                    disabled={deleting}
                    className="px-4 py-2 rounded text-sm font-semibold text-white disabled:opacity-50"
                    style={{ background: '#dc3545' }}
                  >
                    {deleting ? 'Suppression...' : 'Supprimer'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add member modal */}
        {showAddMemberModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
            onClick={() => setShowAddMemberModal(false)}
          >
            <div
              className="card-cassie w-full max-w-md p-6 mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-semibold" style={{ color: '#06072d' }}>
                  Ajouter un membre
                </h3>
                <button
                  onClick={() => setShowAddMemberModal(false)}
                  className="p-1 rounded hover:bg-[#f9f9fd]"
                  style={{ color: '#8392a5' }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Role selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1" style={{ color: '#373857' }}>
                  Rôle
                </label>
                <select
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value as EstablishmentRole)}
                  className="w-full text-sm border rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#5556fd]"
                  style={{ borderColor: '#e6e7ef', color: '#373857' }}
                >
                  <option value="admin">{ROLE_LABELS.admin}</option>
                  <option value="user">{ROLE_LABELS.user}</option>
                </select>
              </div>

              {/* Search */}
              <div className="relative mb-4">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: '#8392a5' }}
                />
                <input
                  type="text"
                  placeholder="Rechercher par email ou nom..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="w-full text-sm border rounded pl-9 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#5556fd]"
                  style={{ borderColor: '#e6e7ef', color: '#373857' }}
                  autoFocus
                />
              </div>

              {/* Results */}
              <div className="max-h-60 overflow-y-auto space-y-1">
                {memberSearch.trim() && filteredUsers.length === 0 && (
                  <p className="text-sm text-center py-4" style={{ color: '#8392a5' }}>
                    Aucun utilisateur trouvé.
                  </p>
                )}
                {filteredUsers.slice(0, 20).map((u) => (
                  <button
                    key={u.uid}
                    onClick={() => handleAddMember(u)}
                    disabled={addingMember}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded text-left hover:bg-[#f0f0ff] transition-colors disabled:opacity-50"
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                      style={{ background: '#5556fd' }}
                    >
                      {u.displayName?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: '#06072d' }}>
                        {u.displayName}
                      </p>
                      <p className="text-xs truncate" style={{ color: '#8392a5' }}>
                        {u.email}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Create/Edit modal (also available from detail view when editing) */}
        {showCreateModal && renderFormModal()}
      </div>
    );
  }

  // --- form modal (shared between create & edit) ---
  function renderFormModal() {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
        onClick={closeFormModal}
      >
        <div className="card-cassie w-full max-w-md p-6 mx-4" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-semibold" style={{ color: '#06072d' }}>
              {editingEstablishment ? "Modifier l'établissement" : 'Créer un établissement'}
            </h3>
            <button
              onClick={closeFormModal}
              className="p-1 rounded hover:bg-[#f9f9fd]"
              style={{ color: '#8392a5' }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {formError && (
            <div
              className="mb-4 p-2 rounded text-sm"
              style={{ background: '#fce8ea', color: '#dc3545' }}
            >
              {formError}
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="space-y-4">
            {renderFormInput('Nom', formData.name, (v) => setFormData({ ...formData, name: v }), true)}
            {renderFormInput('Code', formData.code, (v) => setFormData({ ...formData, code: v }))}
            {renderFormSelect('Type', formData.type, (v) => setFormData({ ...formData, type: v as EstablishmentType }), [
              { value: 'college', label: 'Collège' },
              { value: 'lycee', label: 'Lycée' },
              { value: 'college-lycee', label: 'Collège-Lycée' },
            ])}
            {renderFormSelect('Cycle', formData.cycle, (v) => setFormData({ ...formData, cycle: v as EstablishmentCycle }), [
              { value: 'college', label: 'Collège' },
              { value: 'lycee', label: 'Lycée' },
              { value: 'both', label: 'Les deux' },
            ])}
            {renderFormInput('Adresse', formData.address, (v) => setFormData({ ...formData, address: v }))}
            {renderFormInput('Ville', formData.city, (v) => setFormData({ ...formData, city: v }))}
            {renderFormInput('Région', formData.region, (v) => setFormData({ ...formData, region: v }))}

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={closeFormModal}
                className="px-4 py-2 rounded text-sm font-medium border"
                style={{ borderColor: '#e6e7ef', color: '#575d78' }}
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={formSaving}
                className="px-4 py-2 rounded text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: '#5556fd' }}
              >
                {formSaving
                  ? 'Enregistrement...'
                  : editingEstablishment
                    ? 'Enregistrer'
                    : 'Créer'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // --- main list view ---
  return (
    <div className="min-h-screen" style={{ background: '#f9f9fd' }}>
      <header className="bg-white border-b" style={{ borderColor: '#e6e7ef' }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/sessions"
              className="p-1.5 rounded hover:bg-[#f0f0ff] transition-colors"
              style={{ color: '#5556fd' }}
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-semibold" style={{ color: '#06072d' }}>
                Administration Système
              </h1>
              <p className="text-xs" style={{ color: '#8392a5' }}>
                Gestion des établissements
              </p>
            </div>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold text-white"
            style={{ background: '#5556fd' }}
          >
            <Plus className="w-4 h-4" /> Créer un établissement
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {error && (
          <div
            className="mb-6 p-3 rounded text-sm"
            style={{ background: '#fce8ea', color: '#dc3545' }}
          >
            {error}
          </div>
        )}

        {/* API Configuration */}
        <ApiConfigPanel />

        {loading ? (
          <div className="text-center py-20">
            <div
              className="w-8 h-8 border-3 border-t-transparent rounded-full animate-spin mx-auto mb-3"
              style={{ borderColor: '#5556fd', borderTopColor: 'transparent' }}
            />
            <p className="text-sm" style={{ color: '#8392a5' }}>
              Chargement des établissements...
            </p>
          </div>
        ) : establishments.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex p-4 rounded-full mb-4" style={{ background: '#f0f0ff' }}>
              <Building2 className="w-8 h-8" style={{ color: '#5556fd' }} />
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: '#06072d' }}>
              Aucun établissement
            </h3>
            <p className="text-sm mb-6" style={{ color: '#8392a5' }}>
              Commencez par créer votre premier établissement.
            </p>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold text-white"
              style={{ background: '#5556fd' }}
            >
              <Plus className="w-4 h-4" /> Créer un établissement
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {establishments.map((est) => (
              <button
                key={est.id}
                onClick={() => setSelectedEstablishment(est)}
                className="card-cassie p-5 text-left hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="p-2 rounded"
                    style={{ background: '#f0f0ff' }}
                  >
                    <Building2 className="w-5 h-5" style={{ color: '#5556fd' }} />
                  </div>
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded"
                    style={{ background: '#f0f0ff', color: '#5556fd' }}
                  >
                    {TYPE_LABELS[est.type]}
                  </span>
                </div>
                <h3 className="text-sm font-semibold mb-1" style={{ color: '#06072d' }}>
                  {est.name}
                </h3>
                {ownerNames[est.createdBy] && (
                  <p className="text-xs mb-1" style={{ color: '#575d78' }}>
                    Créé par {ownerNames[est.createdBy]}
                  </p>
                )}
                {est.code && (
                  <p className="text-xs mb-2" style={{ color: '#8392a5' }}>
                    Code : {est.code}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-3 pt-3 border-t" style={{ borderColor: '#e6e7ef' }}>
                  {est.city && (
                    <span className="text-xs" style={{ color: '#575d78' }}>
                      {est.city}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-xs ml-auto" style={{ color: '#8392a5' }}>
                    <Users className="w-3.5 h-3.5" />
                    {memberCounts[est.id] ?? '—'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {showCreateModal && renderFormModal()}
    </div>
  );
}

// --- small helper component ---
function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium mb-0.5" style={{ color: '#8392a5' }}>
        {label}
      </p>
      <p className="text-sm" style={{ color: '#06072d' }}>
        {value}
      </p>
    </div>
  );
}
