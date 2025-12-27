import { useEffect, useState, useMemo, useCallback } from 'react';
import { gameClient } from '../api/gameClient';
import { useGame } from '../context/GameContext';
import type {
  TechnologyCatalogue,
  PlayerTechnologyInventory,
  TechnologyPrerequisite,
  TechnologyResearchMaterial,
  MaterialCatalogue,
} from '../types';

type TechnologyStatus = 'completed' | 'in_progress' | 'available' | 'locked' | 'not_available';

interface TechnologyWithDetails extends TechnologyCatalogue {
  status: TechnologyStatus;
  prerequisites: TechnologyCatalogue[];
  requiredMaterials: Array<TechnologyResearchMaterial & { material: MaterialCatalogue | undefined }>;
  playerTech?: PlayerTechnologyInventory;
  remainingTime?: number; // in minutes
}

export function ResearchPage() {
  const { materialsCatalogue, lastRefresh } = useGame();
  const [technologies, setTechnologies] = useState<TechnologyCatalogue[]>([]);
  const [playerTech, setPlayerTech] = useState<PlayerTechnologyInventory[]>([]);
  const [prerequisites, setPrerequisites] = useState<TechnologyPrerequisite[]>([]);
  const [researchMaterials, setResearchMaterials] = useState<TechnologyResearchMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showOnlyResearchable, setShowOnlyResearchable] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [techResult, playerTechResult, prereqResult, materialsResult] = await Promise.all([
        gameClient.get_technology_catalogue(),
        gameClient.get_player_technology_inventory(),
        gameClient.get_technology_prerequisites(),
        gameClient.get_technology_research_materials(),
      ]);

      if (!techResult.success) throw new Error(techResult.error || 'Failed to load technologies');
      if (!playerTechResult.success) throw new Error(playerTechResult.error || 'Failed to load player technologies');
      if (!prereqResult.success) throw new Error(prereqResult.error || 'Failed to load prerequisites');
      if (!materialsResult.success) throw new Error(materialsResult.error || 'Failed to load research materials');

      setTechnologies(techResult.data || []);
      setPlayerTech(playerTechResult.data || []);
      setPrerequisites(prereqResult.data || []);
      setResearchMaterials(materialsResult.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, lastRefresh]);

  // Create lookup maps
  const playerTechMap = useMemo(() => {
    const map = new Map<number, PlayerTechnologyInventory>();
    playerTech.forEach((pt) => map.set(pt.tech_id, pt));
    return map;
  }, [playerTech]);

  const completedTechIds = useMemo(() => {
    return new Set(
      playerTech.filter((pt) => pt.tech_status === 'completed').map((pt) => pt.tech_id)
    );
  }, [playerTech]);

  // Build prerequisites map: tech_id -> required tech IDs
  const prerequisitesMap = useMemo(() => {
    const map = new Map<number, number[]>();
    prerequisites.forEach((prereq) => {
      const existing = map.get(prereq.tech_to_research) || [];
      existing.push(prereq.tech_required);
      map.set(prereq.tech_to_research, existing);
    });
    return map;
  }, [prerequisites]);

  // Build materials map: tech_id -> materials
  const materialsMap = useMemo(() => {
    const map = new Map<number, TechnologyResearchMaterial[]>();
    researchMaterials.forEach((mat) => {
      const existing = map.get(mat.tech_id) || [];
      existing.push(mat);
      map.set(mat.tech_id, existing);
    });
    return map;
  }, [researchMaterials]);

  // Calculate remaining time for in-progress research
  const calculateRemainingTime = useCallback((playerTechItem: PlayerTechnologyInventory): number => {
    if (!playerTechItem.technology_catalogue) return 0;
    const startTime = new Date(playerTechItem.created_at).getTime();
    const now = currentTime;
    const elapsedMinutes = Math.floor((now - startTime) / (1000 * 60));
    const remaining = playerTechItem.technology_catalogue.tech_time - elapsedMinutes;
    return Math.max(0, remaining);
  }, [currentTime]);

  // Determine technology status and build details
  const technologiesWithDetails = useMemo((): TechnologyWithDetails[] => {
    return technologies.map((tech) => {
      const playerTechItem = playerTechMap.get(tech.tech_id);
      const prereqIds = prerequisitesMap.get(tech.tech_id) || [];
      const techMaterials = materialsMap.get(tech.tech_id) || [];

      let status: TechnologyStatus;
      let remainingTime: number | undefined;

      if (playerTechItem) {
        if (playerTechItem.tech_status === 'completed') {
          status = 'completed';
        } else {
          status = 'in_progress';
          remainingTime = calculateRemainingTime(playerTechItem);
        }
      } else {
        // Check prerequisites (OR logic - need at least ONE)
        if (prereqIds.length === 0) {
          status = 'available';
        } else {
          const hasPrerequisite = prereqIds.some((prereqId) => completedTechIds.has(prereqId));
          status = hasPrerequisite ? 'available' : 'locked';
        }
      }

      // Get prerequisite technologies
      const prereqTechs = prereqIds
        .map((id) => technologies.find((t) => t.tech_id === id))
        .filter((t): t is TechnologyCatalogue => t !== undefined);

      // Get required materials with catalogue info
      const requiredMaterials = techMaterials.map((mat) => ({
        ...mat,
        material: materialsCatalogue.get(mat.res_id),
      }));

      return {
        ...tech,
        status,
        prerequisites: prereqTechs,
        requiredMaterials,
        playerTech: playerTechItem,
        remainingTime,
      };
    });
  }, [
    technologies,
    playerTechMap,
    prerequisitesMap,
    materialsMap,
    completedTechIds,
    calculateRemainingTime,
    materialsCatalogue,
  ]);

  // Filter technologies
  const filteredTechnologies = useMemo(() => {
    if (!showOnlyResearchable) {
      return technologiesWithDetails;
    }
    return technologiesWithDetails.filter((tech) => tech.status === 'available');
  }, [technologiesWithDetails, showOnlyResearchable]);

  // Get player's research status
  const completedResearch = useMemo(() => {
    return technologiesWithDetails.filter((tech) => tech.status === 'completed');
  }, [technologiesWithDetails]);

  const inProgressResearch = useMemo(() => {
    return technologiesWithDetails.filter((tech) => tech.status === 'in_progress');
  }, [technologiesWithDetails]);

  // Update remaining time every minute for in-progress research
  useEffect(() => {
    if (inProgressResearch.length === 0) return;

    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [inProgressResearch.length]);

  const handleStartResearch = async (techId: number) => {
    const tech = technologies.find((t) => t.tech_id === techId);
    if (!tech) return;

    if (!window.confirm(`Start research on "${tech.tech_name}"?\n\nCost: ${tech.tech_cost.toLocaleString()} cash\nTime: ${tech.tech_time} minutes`)) {
      return;
    }

    setStatus(null);
    const result = await gameClient.start_research(techId);
    if (result.success) {
      setStatus({ type: 'success', message: `Started research on "${tech.tech_name}"` });
      await loadData();
    } else {
      setStatus({ type: 'error', message: `Failed to start research: ${result.error}` });
    }
  };

  const formatNumber = (num: number | null | undefined) => {
    if (num === null || num === undefined) return '-';
    return num.toLocaleString();
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getStatusBadge = (status: TechnologyStatus) => {
    switch (status) {
      case 'completed':
        return <span className="status-badge completed">✓ Researched</span>;
      case 'in_progress':
        return <span className="status-badge in-progress">⏳ In Progress</span>;
      case 'available':
        return <span className="status-badge available">🔓 Available</span>;
      case 'locked':
        return <span className="status-badge locked">🔒 Locked</span>;
      default:
        return null;
    }
  };

  if (loading && technologies.length === 0) {
    return <div className="loading">Loading research data...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <div className="research-page">
      <h2>🔬 Research</h2>

      {/* Player's Research Status */}
      <section className="player-research-status">
        <h3>Your Research Status</h3>

        {/* Completed Research */}
        {completedResearch.length > 0 && (
          <div className="research-section">
            <h4>✓ Completed Research ({completedResearch.length})</h4>
            <div className="tech-grid">
              {completedResearch.map((tech) => (
                <div key={tech.tech_id} className="tech-card completed">
                  <div className="tech-card-header">
                    <h5>{tech.tech_name}</h5>
                    {getStatusBadge(tech.status)}
                  </div>
                  <div className="tech-details">
                    <p><strong>Code:</strong> {tech.tech_code}</p>
                    <p><strong>ID:</strong> {tech.tech_id}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* In Progress Research */}
        {inProgressResearch.length > 0 && (
          <div className="research-section">
            <h4>⏳ Research In Progress ({inProgressResearch.length})</h4>
            <div className="tech-grid">
              {inProgressResearch.map((tech) => (
                <div key={tech.tech_id} className="tech-card in-progress">
                  <div className="tech-card-header">
                    <h5>{tech.tech_name}</h5>
                    {getStatusBadge(tech.status)}
                  </div>
                  <div className="tech-details">
                    <p><strong>Code:</strong> {tech.tech_code}</p>
                    <p><strong>ID:</strong> {tech.tech_id}</p>
                    {tech.remainingTime !== undefined && (
                      <p><strong>Time Remaining:</strong> {formatTime(tech.remainingTime)}</p>
                    )}
                    <p><strong>Total Time:</strong> {formatTime(tech.tech_time)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {completedResearch.length === 0 && inProgressResearch.length === 0 && (
          <div className="empty-state">No research completed or in progress.</div>
        )}
      </section>

      {/* Technology Catalogue */}
      <section className="technology-catalogue">
        <div className="catalogue-header">
          <h3>Technology Catalogue</h3>
          <label className="filter-toggle">
            <input
              type="checkbox"
              checked={showOnlyResearchable}
              onChange={(e) => setShowOnlyResearchable(e.target.checked)}
            />
            Show only researchable technologies
          </label>
        </div>

        <div className="filter-results-count" style={{ marginBottom: '15px', color: '#666', fontSize: '14px' }}>
          Showing {filteredTechnologies.length} of {technologies.length} technologies
        </div>

        {filteredTechnologies.length === 0 ? (
          <div className="empty-state">No technologies match the current filter.</div>
        ) : (
          <div className="tech-catalogue-grid">
            {filteredTechnologies.map((tech) => (
              <div key={tech.tech_id} className={`tech-card ${tech.status}`}>
                <div className="tech-card-header">
                  <h4>{tech.tech_name}</h4>
                  {getStatusBadge(tech.status)}
                </div>

                <div className="tech-details">
                  <p><strong>Code:</strong> {tech.tech_code}</p>
                  <p><strong>ID:</strong> {tech.tech_id}</p>
                  <p><strong>Cost:</strong> {formatNumber(tech.tech_cost)} cash</p>
                  <p><strong>Research Time:</strong> {formatTime(tech.tech_time)}</p>
                </div>

                {/* Prerequisites */}
                {tech.prerequisites.length > 0 && (
                  <div className="tech-prerequisites">
                    <h5>Prerequisites (need any one):</h5>
                    <ul>
                      {tech.prerequisites.map((prereq) => {
                        const isCompleted = completedTechIds.has(prereq.tech_id);
                        return (
                          <li key={prereq.tech_id} className={isCompleted ? 'completed' : 'missing'}>
                            {isCompleted ? '✓' : '✗'} {prereq.tech_name}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {/* Required Materials */}
                {tech.requiredMaterials.length > 0 && (
                  <div className="tech-materials">
                    <h5>Required Materials:</h5>
                    <ul>
                      {tech.requiredMaterials.map((mat) => (
                        <li key={mat.res_id}>
                          {mat.material?.res_name || `Material ${mat.res_id}`}: {formatNumber(mat.res_amount)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Action Button */}
                {tech.status === 'available' && (
                  <button
                    onClick={() => handleStartResearch(tech.tech_id)}
                    className="btn-primary"
                    style={{ width: '100%', marginTop: '10px' }}
                  >
                    🔬 Start Research
                  </button>
                )}

                {tech.status === 'locked' && (
                  <div className="locked-message" style={{ marginTop: '10px', color: '#999', fontSize: '14px' }}>
                    Complete at least one prerequisite to unlock
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {status && (
        <div className={`status-message ${status.type}`} style={{ marginTop: '20px' }}>
          {status.message}
        </div>
      )}
    </div>
  );
}

