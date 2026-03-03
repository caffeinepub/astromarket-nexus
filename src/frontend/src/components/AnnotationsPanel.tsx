import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { Edit2, Plus, Search, Tag, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { Annotation } from "../backend.d";
import {
  useAddAnnotation,
  useAnnotations,
  useDeleteAnnotation,
  useUpdateAnnotation,
} from "../hooks/useQueries";
import { useAppStore } from "../store/useAppStore";

function generateId(): string {
  return `ann_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function AnnotationsPanel() {
  const { selectedTimestamp } = useAppStore();
  // Show all annotations from 50 years ago up to 5 years in future
  const startTimestamp = Math.floor(Date.now() / 1000) - 50 * 365 * 86400;
  const endTimestamp = Math.floor(Date.now() / 1000) + 5 * 365 * 86400;

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterTag, setFilterTag] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formAuthor, setFormAuthor] = useState("");

  const { data: annotations = [], isLoading } = useAnnotations(
    startTimestamp,
    endTimestamp,
  );

  const addAnnotation = useAddAnnotation();
  const deleteAnnotation = useDeleteAnnotation();
  const updateAnnotation = useUpdateAnnotation();

  // Filter annotations
  const filtered = useMemo(() => {
    return annotations.filter((ann) => {
      const matchesTag =
        !filterTag ||
        ann.tags.some((t) => t.toLowerCase().includes(filterTag.toLowerCase()));
      const matchesSearch =
        !searchQuery ||
        ann.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ann.body.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesTag && matchesSearch;
    });
  }, [annotations, filterTag, searchQuery]);

  // Get all unique tags
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const ann of annotations) {
      for (const t of ann.tags) {
        tags.add(t);
      }
    }
    return Array.from(tags);
  }, [annotations]);

  const resetForm = () => {
    setFormTitle("");
    setFormBody("");
    setFormTags("");
    setFormAuthor("");
  };

  const handleSubmit = async () => {
    if (!formTitle.trim()) {
      toast.error("Title is required");
      return;
    }

    const annotation: Annotation = {
      id: generateId(),
      title: formTitle.trim(),
      body: formBody.trim(),
      tags: formTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      authorNote: formAuthor.trim(),
      timestamp: BigInt(selectedTimestamp),
    };

    try {
      if (editingId) {
        await updateAnnotation.mutateAsync({
          id: editingId,
          updated: { ...annotation, id: editingId },
        });
        toast.success("Annotation updated");
        setEditingId(null);
      } else {
        await addAnnotation.mutateAsync(annotation);
        toast.success("Annotation saved");
      }
      resetForm();
      setIsAdding(false);
    } catch {
      toast.error("Failed to save annotation");
    }
  };

  const handleEdit = (ann: Annotation) => {
    setEditingId(ann.id);
    setFormTitle(ann.title);
    setFormBody(ann.body);
    setFormTags(ann.tags.join(", "));
    setFormAuthor(ann.authorNote);
    setIsAdding(true);
  };

  const handleDelete = async (id: string, index: number) => {
    try {
      await deleteAnnotation.mutateAsync(id);
      toast.success("Annotation deleted");
    } catch {
      toast.error("Failed to delete annotation");
    }
    void index; // used in data-ocid
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    resetForm();
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-3 border-b border-border/30">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-display font-semibold text-xl text-foreground">
              Research Annotations
            </h2>
            <p className="font-mono text-xs text-muted-foreground mt-0.5">
              Timestamped observations tied to the timeline
            </p>
          </div>
          <Button
            onClick={() => {
              setIsAdding(true);
              setEditingId(null);
              resetForm();
            }}
            className="font-mono text-xs bg-neon-blue/20 border border-neon-blue/40 
              text-neon-blue hover:bg-neon-blue/30 transition-all duration-200"
            variant="outline"
            size="sm"
            data-ocid="annotations.add.button"
          >
            <Plus className="w-3 h-3 mr-1" />
            New Annotation
          </Button>
        </div>

        {/* Search & filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search annotations..."
              className="pl-7 font-mono text-xs h-8 bg-muted/50 border-border/50"
              data-ocid="annotations.search_input"
            />
          </div>
          <div className="relative">
            <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <Input
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
              placeholder="Filter by tag..."
              className="pl-7 font-mono text-xs h-8 bg-muted/50 border-border/50 w-36"
            />
          </div>
        </div>

        {/* Tag cloud */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {allTags.slice(0, 12).map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setFilterTag(filterTag === tag ? "" : tag)}
                className="transition-all duration-150"
              >
                <Badge
                  variant="outline"
                  className={`font-mono text-[9px] cursor-pointer transition-all
                    ${
                      filterTag === tag
                        ? "bg-neon-blue/20 border-neon-blue text-neon-blue"
                        : "border-border/50 text-muted-foreground hover:border-border"
                    }`}
                >
                  #{tag}
                </Badge>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit form */}
      {isAdding && (
        <div className="flex-shrink-0 px-6 py-4 border-b border-border/30 glass">
          <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">
            {editingId ? "Edit Annotation" : "New Annotation"} —{" "}
            {format(new Date(selectedTimestamp * 1000), "MMM d, yyyy")}
          </h3>
          <div className="space-y-2">
            <Input
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="Title *"
              className="font-mono text-xs bg-muted/50 border-border/50 h-8"
              data-ocid="annotations.title.input"
            />
            <Textarea
              value={formBody}
              onChange={(e) => setFormBody(e.target.value)}
              placeholder="Observation details, findings, notes..."
              className="font-mono text-xs bg-muted/50 border-border/50 min-h-[80px] resize-none"
              data-ocid="annotations.body.textarea"
            />
            <div className="flex gap-2">
              <Input
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
                placeholder="Tags (comma-separated)"
                className="font-mono text-xs bg-muted/50 border-border/50 h-8 flex-1"
                data-ocid="annotations.tags.input"
              />
              <Input
                value={formAuthor}
                onChange={(e) => setFormAuthor(e.target.value)}
                placeholder="Researcher note"
                className="font-mono text-xs bg-muted/50 border-border/50 h-8 flex-1"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                className="font-mono text-xs"
                data-ocid="annotations.cancel_button"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={addAnnotation.isPending || updateAnnotation.isPending}
                className="font-mono text-xs bg-neon-blue/20 border border-neon-blue/40 
                  text-neon-blue hover:bg-neon-blue/30"
                variant="outline"
                data-ocid="annotations.submit_button"
              >
                {addAnnotation.isPending || updateAnnotation.isPending
                  ? "Saving..."
                  : editingId
                    ? "Update"
                    : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Annotations list */}
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-3">
          {isLoading && (
            <div
              className="text-center py-8 font-mono text-xs text-muted-foreground"
              data-ocid="annotations.loading_state"
            >
              Loading annotations...
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div
              className="text-center py-12 glass rounded-xl border border-border/30"
              data-ocid="annotations.empty_state"
            >
              <div className="text-2xl mb-2">📝</div>
              <p className="font-mono text-xs text-muted-foreground">
                No annotations found.
              </p>
              <p className="font-mono text-[10px] text-muted-foreground/60 mt-1">
                Add observations tied to specific moments in time.
              </p>
            </div>
          )}

          {filtered.map((ann, idx) => (
            <div
              key={ann.id}
              className="glass rounded-xl p-4 border border-border/30 hover:border-border/50 
                transition-all duration-200 group"
              data-ocid={`annotations.item.${idx + 1}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-mono text-xs font-semibold text-foreground truncate">
                      {ann.title}
                    </h4>
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground mb-2">
                    {format(
                      new Date(Number(ann.timestamp) * 1000),
                      "MMM d, yyyy HH:mm",
                    )}
                    {ann.authorNote && (
                      <span className="ml-2 text-muted-foreground/60">
                        — {ann.authorNote}
                      </span>
                    )}
                  </div>
                  {ann.body && (
                    <p className="font-mono text-[11px] text-foreground/80 leading-relaxed mb-2">
                      {ann.body}
                    </p>
                  )}
                  {ann.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {ann.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className="font-mono text-[8px] border-border/40 text-muted-foreground"
                        >
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handleEdit(ann)}
                    className="p-1.5 rounded hover:bg-neon-blue/20 text-muted-foreground 
                      hover:text-neon-blue transition-colors"
                    title="Edit annotation"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(ann.id, idx + 1)}
                    className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground 
                      hover:text-destructive transition-colors"
                    title="Delete annotation"
                    data-ocid={`annotations.delete_button.${idx + 1}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
