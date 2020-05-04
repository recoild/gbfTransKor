from os import walk
def FindListCSV(path = "./", name = ""):
    fList = []
    for (dirpath, dirnames, filenames) in walk(path):
        for ifile in filenames:
            #print(f"{dirpath}{ifile}")
            if("csv" in ifile):
                fList.append(f"{dirpath}{ifile}")
    return fList

def merge(source="archive", inputpath = "./", outputpath = "./"):
    outputname = outputpath
    if(inputpath[1] is not "/"):
        outputname += "/"
    outputname += source
    if(outputpath is inputpath):
        outputname += "_merged" # if it is in a same folder, prevent overwriting
    outputname += ".csv"
    print(outputname)
    fullCSVlist = FindListCSV(inputpath,source)
    fout=open(outputname,"w")
    
    firstCount = 1
    for filename in fullCSVlist:
        if(outputname in filename):
            continue
        if(firstCount > 0):
            for line in open(filename):
                fout.write(line)
            firstCount = 0
        else:
            f = open(filename)
            a = f.readline() # skip the header
            for line in f:
                fout.write(line)
            f.close()
    fout.close()

if(__name__ == '__main__'):
    merge()