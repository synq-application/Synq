import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
    Alert,
    Keyboard,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from "react-native";

type MonthlyMemoProps = {
  ACCENT: string;
  fonts: { heavy: string; medium: string; black: string };
  showEventModal: boolean;
  setShowEventModal: (val: boolean) => void;
  newEvent: { title: string; date: string; time: string; location: string };
  setNewEvent: React.Dispatch<any>;
  saveEvent: () => void;
  deleteEvent: (index: number) => void;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  events: { date: string; day: number; title: string; time?: string }[];
};

export default function MonthlyMemo({
  ACCENT,
  fonts,
  showEventModal,
  setShowEventModal,
  newEvent,
  setNewEvent,
  saveEvent,
  deleteEvent,
  selectedDate,
  setSelectedDate,
  events,
}: MonthlyMemoProps) {
  const [pickerMode, setPickerMode] = useState<"date" | "time" | null>(null);

  const daysInMonth = new Date(
    selectedDate.getFullYear(),
    selectedDate.getMonth() + 1,
    0
  ).getDate();

  const startDay = new Date(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    1
  ).getDay();

  const calendarDays = [
    ...Array(startDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const times = useMemo(() => {
    const arr: string[] = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 15) {
        const hour = ((h + 11) % 12) + 1;
        const ampm = h >= 12 ? "PM" : "AM";
        const min = m.toString().padStart(2, "0");
        arr.push(`${hour}:${min} ${ampm}`);
      }
    }
    return arr;
  }, []);

  const formatDate = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const resetEvent = () => {
    setNewEvent({
      title: "",
      date: "",
      time: "",
      location: "",
    });
    setPickerMode(null);
  };

  const openModal = () => {
    setNewEvent((p:any) => ({
      ...p,
      date: formatDate(selectedDate), 
    }));
    setShowEventModal(true);
  };

  const handleDelete = (index: number) => {
    Alert.alert(
      "Delete event",
      "Are you sure you want to delete this event?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteEvent(index) },
      ]
    );
  };

  return (
    <View style={{ marginTop: 30, width: "95%", alignSelf: "center" }}>
      <Text style={{ color: "white", fontSize: 20, fontFamily: fonts.heavy, marginLeft: 10 }}>
        Monthly memo
      </Text>

      <View style={{ alignItems: "center", marginTop: 10 }}>
        <View style={styles.card}>
          <View style={styles.row}>
            <TouchableOpacity onPress={() =>
              setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1))
            }>
              <Ionicons name="chevron-back" size={18} color="#888" />
            </TouchableOpacity>

            <Text style={{ color: "white" }}>
              {selectedDate.toLocaleString("default", { month: "long" }).toUpperCase()}
            </Text>

            <TouchableOpacity onPress={() =>
              setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1))
            }>
              <Ionicons name="chevron-forward" size={18} color="#888" />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: "row", marginBottom: 6 }}>
            {["S","M","T","W","T","F","S"].map((d,i)=>(
              <Text key={`${d}-${i}`} style={styles.week}>{d}</Text>
            ))}
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {calendarDays.map((day,i)=>{
              if(!day) return <View key={i} style={styles.day}/>;
              const selected = selectedDate.getDate()===day;
              return(
                <TouchableOpacity
                  key={i}
                  onPress={()=>setSelectedDate(new Date(selectedDate.getFullYear(),selectedDate.getMonth(),day))}
                  style={[styles.day,selected&&{borderWidth:1,borderColor:ACCENT}]}
                >
                  <Text style={{color:selected?ACCENT:"#666"}}>{day}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={{ marginTop: 16 }}>
            {events.map((e, i) => (
              <TouchableOpacity key={i} onLongPress={() => handleDelete(i)} style={styles.eventCard}>
                <View style={styles.dateBlock}>
                  <Text style={{ color: "#666", fontSize: 11 }}>
                    {new Date(selectedDate.getFullYear(), selectedDate.getMonth(), e.day)
                      .toLocaleDateString("en-US", { weekday: "short" })}
                  </Text>
                  <Text style={{ color: "white", fontSize: 18, fontWeight: "600" }}>{e.day}</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{ color: "white" }}>{e.title}</Text>
                  {e.time && <Text style={{ color: "#666", fontSize: 12 }}>{e.time}</Text>}
                </View>

                <Ionicons name="chevron-forward" size={16} color="#666" />
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={[styles.addBtn,{borderColor:ACCENT}]} onPress={openModal}>
              <Ionicons name="add" size={16} color={ACCENT} />
              <Text style={{ marginLeft: 6, color: ACCENT, fontFamily: fonts.heavy }}>
                New event
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <Modal visible={showEventModal} transparent animationType="fade">
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={()=>{Keyboard.dismiss();setPickerMode(null);}}>
            <View style={StyleSheet.absoluteFillObject}/>
          </TouchableWithoutFeedback>

          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modal}>
              <Text style={{ color: "white", fontSize: 20, marginBottom: 20 }}>
                Add an event
              </Text>

              <TextInput
                style={styles.field}
                value={newEvent.title}
                onFocus={()=>setPickerMode(null)}
                onChangeText={(t)=>setNewEvent((p:any)=>({...p,title:t}))}
                placeholder="What’s the plan?"
                placeholderTextColor="#555"
                cursorColor={ACCENT}
              />

              <TouchableOpacity style={styles.field} onPress={()=>{Keyboard.dismiss();setPickerMode("date");}}>
                <Text style={{ color: "white" }}>{newEvent.date || "Select date"}</Text>
              </TouchableOpacity>

              {pickerMode==="date" && (
                <View style={styles.picker}>
                  <Text style={styles.pickerMonth}>
                    {selectedDate.toLocaleString("default",{month:"long"}).toUpperCase()}
                  </Text>

                  <View style={{ flexDirection: "row", marginBottom: 6 }}>
                    {["S","M","T","W","T","F","S"].map((d,i)=>(
                      <Text key={`${d}-${i}`} style={styles.week}>{d}</Text>
                    ))}
                  </View>

                  <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                    {calendarDays.map((d,i)=>{
                      if(!d) return <View key={i} style={styles.day}/>;
                      return(
                        <TouchableOpacity
                          key={i}
                          style={styles.day}
                          onPress={()=>{
                            const date=new Date(selectedDate.getFullYear(),selectedDate.getMonth(),d);
                            setNewEvent((p:any)=>({...p,date:formatDate(date)}));
                            setPickerMode(null);
                          }}
                        >
                          <Text style={{ color: "black" }}>{d}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              <TouchableOpacity style={styles.field} onPress={()=>{Keyboard.dismiss();setPickerMode("time");}}>
                <Text style={{ color: "white" }}>{newEvent.time || "Add time"}</Text>
              </TouchableOpacity>

              {pickerMode==="time" && (
                <View style={styles.picker}>
                  <ScrollView style={{ maxHeight: 200 }}>
                    {times.map((t)=>(
                      <TouchableOpacity key={t} onPress={()=>{setNewEvent((p:any)=>({...p,time:t}));setPickerMode(null);}} style={{ padding: 10 }}>
                        <Text style={{ color: "black" }}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 20 }}>
                <TouchableOpacity onPress={()=>{resetEvent();setShowEventModal(false);}}>
                  <Text style={{ color: "#888" }}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.btn} onPress={()=>{saveEvent();resetEvent();setShowEventModal(false);}}>
                  <Text style={{ color: "black", fontWeight: "bold" }}>Create</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card:{width:"92%",backgroundColor:"#111",borderRadius:24,padding:16},
  row:{flexDirection:"row",justifyContent:"space-between",marginBottom:10},
  week:{width:"14.28%",textAlign:"center",color:"#444"},
  day:{width:"14.28%",height:32,alignItems:"center",justifyContent:"center"},
  eventCard:{flexDirection:"row",alignItems:"center",backgroundColor:"#0a0a0a",borderRadius:16,padding:12,marginBottom:10},
  dateBlock:{width:50,alignItems:"center",marginRight:10},
  addBtn:{flexDirection:"row",justifyContent:"center",padding:12,borderWidth:1,borderStyle:"dashed",borderRadius:12,marginTop:10},
  overlay:{flex:1,backgroundColor:"rgba(0,0,0,0.9)",justifyContent:"center",alignItems:"center"},
  modal:{width:"90%",backgroundColor:"#0a0a0a",borderRadius:20,padding:20},
  field:{backgroundColor:"#111",padding:12,borderRadius:12,marginBottom:10,color:"white"},
  btn:{backgroundColor:"#7DFFA6",padding:12,borderRadius:10},
  picker:{backgroundColor:"white",borderRadius:12,padding:10,marginBottom:10},
  pickerMonth:{textAlign:"center",fontWeight:"600",marginBottom:8,color:"black"},
});
