interface User {
    id: number;
    name: string;
}

interface Group {
    id: number;
    name: string;
    members: User[];
}